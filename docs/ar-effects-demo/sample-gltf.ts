/* eslint-disable @typescript-eslint/no-magic-numbers -- -- */
import * as gltf from '@gltf-transform/core'
import { KHRLightsPunctual, KHRMaterialsUnlit, Light } from '@gltf-transform/extensions'
import { moveToDocument } from '@gltf-transform/functions'
import { LandmarkOps } from 'gltf-interactivity/three'
import { Interactivity, InteractivityFaceLandmarks, KHRNodeVisibility } from 'gltf-interactivity/transform'
import sunglassesAsset from 'https://assets.miru.media/gltf/sunglasses.glb'

const USE_UNMODIFIED_ASSET = import.meta.env.DEV
const FACE_ATTACHMENT_OBJECT_INDEX = 0

const setObjectUrls = (jsonDoc: gltf.JSONDocument) => {
  const { json, resources } = jsonDoc

  const [buffers, images] = [json.buffers, json.images].map((dataItems) =>
    dataItems?.map((dataItem) => {
      if (!dataItem.uri) return dataItem
      return { ...dataItem, uri: URL.createObjectURL(new Blob([resources[dataItem.uri]])) }
    }),
  )

  return { ...json, buffers, images }
}

export const createSampleGltf = async () => {
  const io = new gltf.WebIO().registerExtensions([
    InteractivityFaceLandmarks,
    Interactivity,
    KHRLightsPunctual,
    KHRMaterialsUnlit,
    KHRNodeVisibility,
  ])

  if (USE_UNMODIFIED_ASSET) {
    const jsonDoc = await io.writeJSON(await io.read(sunglassesAsset))
    return setObjectUrls(jsonDoc)
  }

  const doc = new gltf.Document()

  const faceLandmarks = doc.createExtension(InteractivityFaceLandmarks)
  const lights = doc.createExtension(KHRLightsPunctual)
  const visibility = doc.createExtension(KHRNodeVisibility)

  const scene = doc.createScene()
  doc.getRoot().setDefaultScene(scene)

  const glassesNode = doc
    .createNode('glasses-attachment')
    .setExtension(visibility.extensionName, visibility.createVisibility().setVisible(false))

  const faceNode = doc
    .createNode('face0')
    .setMesh(
      doc.createMesh('face0-mesh').addPrimitive(
        doc
          .createPrimitive()
          .setExtension(
            faceLandmarks.extensionName,
            faceLandmarks
              .createFaceLandmarksGeometry()
              .setFaceId(0)
              // set to 'projected' to use the video texture
              // set to 'canonical' to use the mediapipe UV mapping and the imported `textureUrl`
              .setUvMode('canonical'),
          )
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

  const faceOccluder = doc
    .createNode('face0-occluder')
    .setMesh(
      doc
        .createMesh('face0-occluder-mesh')
        .addPrimitive(
          doc
            .createPrimitive()
            .setExtension(
              faceLandmarks.extensionName,
              faceLandmarks.createFaceLandmarksGeometry().setFaceId(0).setIsOccluder(true),
            ),
        ),
    )

  const interactivity = doc.createExtension(Interactivity)
  const graph = interactivity.createGraph()
  const TYPES = {
    float3: interactivity.createType().setSignature('float3'),
    int: interactivity.createType().setSignature('int'),
    bool: interactivity.createType().setSignature('bool'),
  }
  const pointerSet = interactivity.createDeclaration().setOp('pointer/set')

  graph.addNode(
    interactivity
      .createNode('test event')
      .setDeclaration(interactivity.createDeclaration().setOp('event/send'))
      .setConfig(
        'event',
        interactivity
          .createEvent()
          .setId('test-event')
          .setValue('testValue', interactivity.createLiteralValue(TYPES.int, 0)),
      ),
  )

  const makeVisibilityUpdate = (node: gltf.Node, visible: boolean) =>
    interactivity
      .createNode()
      .setDeclaration(pointerSet)
      .setConfig('pointer', `/nodes/{node}/extensions/KHR_node_visibility/visible`)
      .setConfig('type', TYPES.bool)
      .setValue('value', interactivity.createLiteralValue(TYPES.bool, visible))
      .setValue('node', node)

  const faceUpdateNode = interactivity
    .createNode('on face landmarks change')
    .setDeclaration(
      interactivity
        .createDeclaration()
        .setOp(LandmarkOps.Face)
        .setOutputValueSocket('translation', TYPES.float3)
        .setOutputValueSocket('rotation', TYPES.float3)
        .setOutputValueSocket('scale', TYPES.float3),
    )
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

  const setTranslationNode = interactivity
    .createNode('update face attachment position')
    .setDeclaration(pointerSet)
    .setConfig('pointer', '/nodes/{node}/translation')
    .setConfig('type', TYPES.float3)
    .setValue('node', glassesNode)
    .setInput('value', faceUpdateNode.createFlow('translation'))

  const setRotationNode = interactivity
    .createNode('update face attachment rotation')
    .setDeclaration(pointerSet)
    .setConfig('pointer', `/nodes/${FACE_ATTACHMENT_OBJECT_INDEX}/rotation`)
    .setConfig('type', TYPES.float3)
    .setInput('value', faceUpdateNode.createFlow('rotation'))

  faceUpdateNode.setFlow('change', setTranslationNode.createFlow())
  setTranslationNode.setFlow('out', setRotationNode.createFlow())

  doc
    .getRoot()
    .setExtension(
      interactivity.extensionName,
      interactivity.createRoot().setDefaultGraph(graph.addNode(faceUpdateNode)),
    )

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

  return setObjectUrls(await io.writeJSON(doc))
}
