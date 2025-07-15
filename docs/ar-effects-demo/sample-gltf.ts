/* eslint-disable @typescript-eslint/no-magic-numbers -- -- */
import * as gltf from '@gltf-transform/core'
import { KHRLightsPunctual, Light } from '@gltf-transform/extensions'
import { moveToDocument } from '@gltf-transform/functions'
import { Interactivity, InteractivityFaceLandmarks } from 'gltf-interactivity/transform'
import sunglassesAsset from 'https://assets.miru.media/gltf/sunglasses.glb'

export const createSampleGltf = async () => {
  const io = new gltf.WebIO().registerExtensions([
    InteractivityFaceLandmarks,
    Interactivity,
    KHRLightsPunctual,
  ])
  const doc = new gltf.Document()

  const faceLandmarks = doc.createExtension(InteractivityFaceLandmarks)
  const lights = doc.createExtension(KHRLightsPunctual)

  const scene = doc.createScene()
  doc.getRoot().setDefaultScene(scene)

  const faceNode = doc.createNode('face0').setMesh(
    doc
      .createMesh('face0-mesh')
      .addPrimitive(
        doc
          .createPrimitive()
          .setExtension(faceLandmarks.extensionName, faceLandmarks.createFaceLandmarksGeometry().setFaceId(0))
          .setMaterial(
            doc
              .createMaterial()
              .setBaseColorFactor([1, 0.6795424696265424, 0, 0.675])
              .setMetallicFactor(1)
              .setRoughnessFactor(0.001)
              .setAlphaMode('BLEND'),
          ),
      )
      .addPrimitive(
        doc
          .createPrimitive()
          .setExtension(
            InteractivityFaceLandmarks.EXTENSION_NAME,
            faceLandmarks.createFaceLandmarksGeometry().setFaceId(0).setIsOccluder(true),
          ),
      ),
  )

  scene.addChild(faceNode)

  const interactivity = doc.createExtension(Interactivity)
  const graph = interactivity.createGraph()
  const TYPES = {
    float3: interactivity.createType().setSignature('float3'),
    int: interactivity.createType().setSignature('int'),
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
          .setValue('testValue', interactivity.createValue().setValue(0).setType(TYPES.int)),
      ),
  )

  const onChangeFaceNode = interactivity
    .createNode('on face landmarks change')
    .setDeclaration(
      interactivity
        .createDeclaration()
        .setOp('faceLandmarks/change')
        .setOutputValueSocket('translation', TYPES.float3)
        .setOutputValueSocket('rotation', TYPES.float3)
        .setOutputValueSocket('scale', TYPES.float3),
    )
    .setConfig('faceId', interactivity.createValue().setValue(0).setType(TYPES.int))

  const setTranslationNode = interactivity
    .createNode('update face attachment position')
    .setDeclaration(pointerSet)
    .setConfig('pointer', interactivity.createValue().setValue('/nodes/{node}/translation'))
    .setConfig('type', TYPES.float3)
    .setValue('node', interactivity.createValue().setValue(1).setType(TYPES.int))
    .setInput('value', onChangeFaceNode.createFlow('translation'))

  const setRotationNode = interactivity
    .createNode('update face attachment rotation')
    .setDeclaration(pointerSet)
    .setConfig('pointer', interactivity.createValue().setValue('/nodes/1/rotation'))
    .setConfig('type', TYPES.float3)
    .setInput('value', onChangeFaceNode.createFlow('rotation'))

  onChangeFaceNode.setFlow('out', setTranslationNode.createFlow())
  setTranslationNode.setFlow('out', setRotationNode.createFlow())

  doc
    .getRoot()
    .setExtension(
      interactivity.extensionName,
      interactivity.createRoot().setDefaultGraph(graph.addNode(onChangeFaceNode)),
    )

  const glassesNode = doc.createNode('glasses-attachment')

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

  scene.addChild(glassesNode)

  scene.addChild(
    doc
      .createNode('directional light')
      .setExtension(
        lights.extensionName,
        lights.createLight().setType(Light.Type.DIRECTIONAL).setColor([1, 1, 1]).setIntensity(2),
      )
      .setTranslation([10, 10, 10])
      .setRotation([-0.2798481423331213, 0.3647051996310008, 0.11591689595929511, 0.8804762392171493]),
  )

  const { json, resources } = await io.writeJSON(doc)

  ;[...(json.buffers ?? []), ...(json.images ?? [])].forEach((dataItem) => {
    if (!dataItem.uri) return
    dataItem.uri = URL.createObjectURL(new Blob([resources[dataItem.uri]]))
  })

  return json
}
