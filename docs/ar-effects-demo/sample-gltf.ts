/* eslint-disable @typescript-eslint/no-magic-numbers -- -- */
import * as gltf from '@gltf-transform/core'
import {
  KHRLightsPunctual,
  KHRMaterialsClearcoat,
  KHRMaterialsUnlit,
  Light,
} from '@gltf-transform/extensions'
import { dedup, moveToDocument, prune, unpartition } from '@gltf-transform/functions'
import { CANONICAL_VERTICES, LANDMARK_INDICES, LandmarkOps, UVS } from 'gltf-ar-effects/three'
import {
  Interactivity,
  InteractivityFaceLandmarks,
  KHRNodeVisibility,
  MIRUMeshOccluder,
} from 'gltf-ar-effects/transform'
import sunglassesAsset from 'https://assets.miru.media/gltf/sunglasses.glb'

const EXTENSIONS = [
  InteractivityFaceLandmarks,
  Interactivity,
  MIRUMeshOccluder,
  KHRLightsPunctual,
  KHRMaterialsUnlit,
  KHRNodeVisibility,
  KHRMaterialsClearcoat,
]

export const createSampleGltf = async (url = sunglassesAsset) => {
  const io = new gltf.WebIO().registerExtensions(EXTENSIONS)

  const doc =
    url === sunglassesAsset
      ? await createMaskEffectWithAsset(io)
      : convertExtrasToExtensions(await io.read(url))

  return (await io.writeBinary(doc)).buffer
}

const setUpExtensions = (doc: gltf.Document) => {
  const interactivity = doc.createExtension(Interactivity)
  const faceLandmarks = doc.createExtension(InteractivityFaceLandmarks)
  const visibility = doc.createExtension(KHRNodeVisibility)
  const occluder = doc.createExtension(MIRUMeshOccluder)
  const lights = doc.createExtension(KHRLightsPunctual)

  const graph = interactivity.createGraph()
  const TYPES = {
    float3: interactivity.createType().setSignature('float3'),
    int: interactivity.createType().setSignature('int'),
    bool: interactivity.createType().setSignature('bool'),
  }
  const pointerSetDeclaration = interactivity.createDeclaration().setOp('pointer/set')

  Object.values(TYPES).forEach((type) => graph.addType(type))

  const makeVisibilityUpdate = (node: gltf.Node, visible: boolean) =>
    interactivity
      .createNode()
      .setDeclaration(pointerSetDeclaration)
      .setConfig('pointer', `/nodes/{node}/extensions/KHR_node_visibility/visible`)
      .setConfig('type', TYPES.bool)
      .setValue('value', interactivity.createLiteralValue(TYPES.bool, visible))
      .setValue('node', node)

  const faceLandmarksDeclaration = interactivity
    .createDeclaration()
    .setOp(LandmarkOps.Face)
    .setOutputValueSocket('translation', TYPES.float3)
    .setOutputValueSocket('rotation', TYPES.float3)
    .setOutputValueSocket('scale', TYPES.float3)

  doc.getRoot().setExtension(interactivity.extensionName, interactivity.createRoot().setDefaultGraph(graph))

  return {
    interactivity,
    faceLandmarks,
    visibility,
    occluder,
    lights,
    graph,
    TYPES,
    pointerSetDeclaration,
    faceLandmarksDeclaration,
    makeVisibilityUpdate,
  }
}

// Testing exporting from Blender with custom properties instead of a custom extension
const convertExtrasToExtensions = (doc: gltf.Document) => {
  const {
    interactivity,
    occluder,
    TYPES,
    graph,
    pointerSetDeclaration,
    faceLandmarks,
    faceLandmarksDeclaration,
    makeVisibilityUpdate,
  } = setUpExtensions(doc)

  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]
  const nodes = doc.getRoot().listNodes()

  const visibilityGroup = doc.createNode()
  scene.listChildren().forEach((node) => {
    scene.removeChild(node)
    visibilityGroup.addChild(node)
  })
  scene.addChild(visibilityGroup)

  const faceUpdateNode = interactivity
    .createNode('on face landmarks change')
    .setDeclaration(faceLandmarksDeclaration)
    .setConfig('faceId', 0)
    .setFlow('start', makeVisibilityUpdate(visibilityGroup, true).createFlow())
    .setFlow('end', makeVisibilityUpdate(visibilityGroup, false).createFlow())

  let lastAttachmentFlowNode = faceUpdateNode
  graph.addNode(faceUpdateNode)

  nodes.forEach((node, i) => {
    const extras = node.getExtras()

    if (extras.isOccluder === true)
      node.getMesh()?.setExtension(occluder.extensionName, occluder.createOccluder())

    if (typeof extras.faceId === 'number') {
      const setTranslationNode = interactivity
        .createNode(`update face attachment position (${i})`)
        .setDeclaration(pointerSetDeclaration)
        .setConfig('pointer', '/nodes/{node}/translation')
        .setConfig('type', TYPES.float3)
        .setValue('node', node)
        .setInput('value', faceUpdateNode.createFlow('translation'))

      const setRotationNode = interactivity
        .createNode(`update face attachment rotation (${i})`)
        .setDeclaration(pointerSetDeclaration)
        .setConfig('pointer', `/nodes/{node}/rotation`)
        .setConfig('type', TYPES.float3)
        .setValue('node', node)
        .setInput('value', faceUpdateNode.createFlow('rotation'))

      lastAttachmentFlowNode.setFlow(
        lastAttachmentFlowNode === faceUpdateNode ? 'change' : 'out',
        setTranslationNode.createFlow(),
      )
      setTranslationNode.setFlow('out', setRotationNode.createFlow())
      lastAttachmentFlowNode = setRotationNode

      if (extras.isFaceAttachment !== true) {
        node
          .getMesh()
          ?.listPrimitives()[0]
          ?.setExtension(
            faceLandmarks.extensionName,
            faceLandmarks
              .createFaceLandmarksGeometry()
              .setFaceId(extras.faceId)
              .setUvMode(extras.uvMode === 'projected' ? 'projected' : null),
          )
      }
    }
  })

  return doc
}

const createMaskEffectWithAsset = async (io: gltf.WebIO) => {
  const doc = new gltf.Document()
  const scene = doc.createScene()
  doc.getRoot().setDefaultScene(scene)

  const {
    interactivity,
    faceLandmarks,
    visibility,
    occluder,
    lights,
    graph,
    TYPES,
    pointerSetDeclaration,
    faceLandmarksDeclaration,
    makeVisibilityUpdate,
  } = setUpExtensions(doc)

  const glassesNode = doc
    .createNode('glasses-attachment')
    .setExtension(visibility.extensionName, visibility.createVisibility().setVisible(false))

  const buffer = doc.createBuffer()
  const canonicalVertices = doc
    .createAccessor('canonical verts', buffer)
    .setArray(CANONICAL_VERTICES)
    .setType('VEC3')
  const canonicalUvs = doc.createAccessor('canonical uvs', buffer).setArray(UVS).setType('VEC2')
  const canonicalIndices = doc.createAccessor('canonical indices', buffer).setArray(LANDMARK_INDICES)

  const faceNode = doc
    .createNode('face0')
    .setMesh(
      doc.createMesh('face0-mesh').addPrimitive(
        doc
          .createPrimitive()
          .setAttribute('POSITION', canonicalVertices)
          .setAttribute('TEXCOORD_0', canonicalUvs)
          .setIndices(canonicalIndices)
          .setExtension(faceLandmarks.extensionName, faceLandmarks.createFaceLandmarksGeometry().setFaceId(0))
          .setMaterial(
            doc
              .createMaterial()
              .setBaseColorFactor([1, 0.6795424696265424, 0, 0.675])
              .setMetallicFactor(1)
              .setRoughnessFactor(0.001)
              .setAlphaMode('BLEND'),
          ),
      ),
    )
    .setExtension(visibility.extensionName, visibility.createVisibility().setVisible(false))

  const faceOccluder = doc.createNode('face0-occluder').setMesh(
    doc
      .createMesh('face0-occluder-mesh')
      .setExtension(occluder.extensionName, occluder.createOccluder())
      .addPrimitive(
        doc
          .createPrimitive()
          .setAttribute('POSITION', canonicalVertices)
          .setIndices(canonicalIndices)
          .setExtension(
            faceLandmarks.extensionName,
            faceLandmarks.createFaceLandmarksGeometry().setFaceId(0),
          ),
      ),
  )

  const faceUpdateNode = interactivity
    .createNode('on face landmarks change')
    .setDeclaration(faceLandmarksDeclaration)
    .setConfig('faceId', 0)
    .setFlow(
      'start',
      makeVisibilityUpdate(glassesNode, true)
        .setFlow('out', makeVisibilityUpdate(faceNode, true).createFlow())
        .createFlow(),
    )
    .setFlow(
      'end',
      makeVisibilityUpdate(glassesNode, false)
        .setFlow('out', makeVisibilityUpdate(faceNode, false).createFlow())
        .createFlow(),
    )

  const setAttachmentTranslationNode = interactivity
    .createNode('update face attachment position')
    .setDeclaration(pointerSetDeclaration)
    .setConfig('pointer', '/nodes/{node}/translation')
    .setConfig('type', TYPES.float3)
    .setValue('node', glassesNode)
    .setInput('value', faceUpdateNode.createFlow('translation'))

  const setAttachmentRotationNode = interactivity
    .createNode('update face attachment rotation')
    .setDeclaration(pointerSetDeclaration)
    .setConfig('pointer', `/nodes/{node}/rotation`)
    .setConfig('type', TYPES.float3)
    .setValue('node', glassesNode)
    .setInput('value', faceUpdateNode.createFlow('rotation'))

  const setFaceTranslationNode = setAttachmentTranslationNode.clone().setValue('node', faceNode)
  const setFaceRotationNode = setAttachmentRotationNode.clone().setValue('node', faceNode)

  faceUpdateNode.setFlow('change', setAttachmentTranslationNode.createFlow())
  setAttachmentTranslationNode.setFlow('out', setAttachmentRotationNode.createFlow())
  setAttachmentRotationNode.setFlow('out', setFaceTranslationNode.createFlow())
  setFaceTranslationNode.setFlow('out', setFaceRotationNode.createFlow())

  graph.addNode(faceUpdateNode)

  {
    const glassesDoc = await io.read(sunglassesAsset)

    glassesDoc
      .getRoot()
      .listMaterials()
      .find((mat) => mat.getName() === 'stekla')
      ?.setAlphaMode('OPAQUE')

    const glassesSourceNodes = glassesDoc.getRoot().getDefaultScene()!.listChildren()
    const map = moveToDocument(doc, glassesDoc, glassesSourceNodes)

    glassesSourceNodes.forEach((sourceNode) => glassesNode.addChild(map.get(sourceNode) as gltf.Node))
  }

  scene
    .addChild(glassesNode)
    .addChild(faceNode)
    .addChild(faceOccluder)
    .addChild(
      doc
        .createNode('directional light')
        .setExtension(
          lights.extensionName,
          lights.createLight().setType(Light.Type.DIRECTIONAL).setColor([1, 1, 1]).setIntensity(2),
        )
        .setTranslation([10, 10, 10])
        .setRotation([-0.2798481423331213, 0.3647051996310008, 0.11591689595929511, 0.8804762392171493]),
    )

  return await doc.transform(dedup(), prune(), unpartition())
}
