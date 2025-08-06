import type * as gltf from '@gltf-transform/core'
import { KHRLightsPunctual } from '@gltf-transform/extensions'

import {
  Interactivity,
  InteractivityFaceLandmarks,
  KHRNodeVisibility,
  LandmarkOps,
  MIRUMeshOccluder,
} from 'gltf-ar-effects/transform'

export const setUpExtensions = (doc: gltf.Document) => {
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
export const convertExtrasToExtensions = (doc: gltf.Document) => {
  if (doc.getRoot().getExtension(Interactivity.EXTENSION_NAME)) return doc

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

      if (!node.getParentNode()) {
        scene.removeChild(node)
        visibilityGroup.addChild(node)
      }

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
