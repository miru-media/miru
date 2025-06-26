import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'

import envHdr from 'shared/assets/textures/equirectangular/venice_sunset_1k.hdr'

import { LANDMARKS_VERTEX_COUNT } from './constants'
import { FaceDetector } from './face-detector'
import { GLTFInteractivityExtension } from './gltf/khr-interactivity/GLTFInteractivityExtension'
import { GLTFFaceLandmarkDetectionExtension } from './gltf/miru-interactivity-face-landmarks/gltf-interactivity-face-landmarks-extension'

const size = { width: 1080, height: 1920 }

const MIRROR = true as boolean

export const createDemo = (options: {
  onInitProgress: (progress: number) => void
  onError: (error: unknown) => void
  onInfo?: (info: unknown) => void
  assetUrl: string
}) => {
  const scene = new THREE.Scene()

  const canvas = document.createElement('canvas')
  const renderer = new THREE.WebGLRenderer({ canvas })

  // https:github.com/google-ai-edge/mediapipe/blob/232008b/mediapipe/tasks/cc/vision/face_geometry/face_geometry_from_landmarks_graph.cc#L71
  const estimatedCamera = new THREE.PerspectiveCamera(63, 1, 1, 10_000)

  estimatedCamera.lookAt(0, 0, -1)
  estimatedCamera.updateProjectionMatrix()
  estimatedCamera.updateMatrixWorld()

  const orthoCamera = new THREE.OrthographicCamera()
  orthoCamera.updateProjectionMatrix()

  const camera = estimatedCamera.clone()
  let controls: OrbitControls | undefined

  if (import.meta.env.DEV) {
    controls = new OrbitControls(camera, canvas)
    controls.zoomToCursor = true
    controls.target.set(0, 0, -1)
    controls.update()

    scene.add(new THREE.GridHelper())
    scene.add(new THREE.AxesHelper())
  }

  const contentGroup = new THREE.Group()
  contentGroup.visible = false
  scene.add(contentGroup)

  const faceDetection = new GLTFFaceLandmarkDetectionExtension()
  const interactivity = new GLTFInteractivityExtension()

  new GLTFLoader()
    .register((parser) => interactivity.init(parser))
    .register((parser) => faceDetection.init(parser))
    .loadAsync(options.assetUrl)
    .then((result) => contentGroup.add(result.scene))
    .catch(options.onError)

  // environment
  {
    const ambient = new THREE.AmbientLight(0x404040, 20)
    const directional = new THREE.DirectionalLight('white', 2)
    directional.position.set(10, 10, 10)
    directional.lookAt(0, 0, 0)
    directional.updateMatrix()

    scene.add(directional, ambient)
    new RGBELoader().load(envHdr, (texture) => {
      scene.environment = new THREE.PMREMGenerator(renderer).fromEquirectangular(texture).texture
    })
  }

  const video = document.createElement('video')
  video.playsInline = video.muted = true
  const videoTexture = new THREE.VideoTexture(video)
  videoTexture.colorSpace = 'srgb'

  if (MIRROR) {
    videoTexture.wrapS = THREE.RepeatWrapping
    videoTexture.repeat.x = -1
  }
  scene.background = videoTexture

  video.addEventListener('loadedmetadata', () => {
    estimatedCamera.aspect = camera.aspect = video.videoWidth / video.videoHeight
    camera.updateProjectionMatrix()
    estimatedCamera.updateProjectionMatrix()
  })

  let stream: MediaStream | undefined

  let lastDetectedTime = 0

  const vector = new THREE.Vector3()

  const detector = new FaceDetector({
    video,
    onDetect: ({ result, timestamp }) => {
      if (timestamp <= lastDetectedTime) return

      lastDetectedTime = timestamp

      if (!result || result.faceLandmarks.length === 0) {
        contentGroup.visible = false
        return
      }

      contentGroup.visible = true

      for (
        let faceIndex = 0, facesLength = result.faceLandmarks.length;
        faceIndex < facesLength;
        faceIndex++
      ) {
        const landmarks = result.faceLandmarks[faceIndex]

        const facialMatrix = new THREE.Matrix4().fromArray(
          result.facialTransformationMatrixes[faceIndex].data,
        )
        const facePosition = new THREE.Vector3().setFromMatrixPosition(facialMatrix)
        const faceRotationQuat = new THREE.Quaternion().setFromRotationMatrix(facialMatrix)
        const faceScale = new THREE.Vector3().setFromMatrixScale(facialMatrix)

        if (MIRROR) {
          facePosition.x *= -1

          {
            const { x, y, z, w } = faceRotationQuat
            faceRotationQuat.set(-x, -y, z, -w)
          }
        }

        const rotationToOrigin = new THREE.Euler().setFromRotationMatrix(
          new THREE.Matrix4().lookAt(estimatedCamera.position, facePosition, scene.up),
        )

        // Try to resolve some issues with the transform matrix rotation and the face mesh distortion
        // https://github.com/google-ai-edge/mediapipe/issues/4759
        facialMatrix
          .multiply(new THREE.Matrix4().makeShear(0, 0, 0, 0, -rotationToOrigin.y / 2, 0))
          .multiply(
            new THREE.Matrix4().makeTranslation(
              new THREE.Vector3(rotationToOrigin.y + new THREE.Euler().setFromQuaternion(faceRotationQuat).y),
            ),
          )

        // https:github.com/google-ai-edge/mediapipe/blob/232008b/mediapipe/tasks/cc/vision/face_geometry/data/canonical_face_model_uv_visualization.png
        const referenceRight = landmarks[227]
        const referenceLeft = landmarks[447]
        vector.set(0, 0, ((referenceRight.z + referenceLeft.z) / 2) * estimatedCamera.aspect)
        vector.unproject(estimatedCamera)
        const scale = facePosition.z / vector.z

        const faceVertices = faceDetection.getFaceGeometryPosition(faceIndex).array

        let offset = 0
        for (let i = 0; i < LANDMARKS_VERTEX_COUNT; i++) {
          const landmark = landmarks[i]

          vector.x = (landmark.x * +2 - 1) * (MIRROR ? -1 : 1)
          vector.y = landmark.y * -2 + 1
          vector.z = landmark.z * estimatedCamera.aspect

          vector.unproject(estimatedCamera)

          faceVertices[offset + 0] = vector.x * scale
          faceVertices[offset + 1] = vector.y * scale
          faceVertices[offset + 2] = vector.z * scale

          offset += 3
        }

        faceDetection.updateFaceGeometries(faceIndex, MIRROR)

        let maybeMirroredRotation
        if (MIRROR) {
          maybeMirroredRotation = faceRotationQuat.clone()
          const { x, y, z, w } = faceRotationQuat
          maybeMirroredRotation.set(x, -y, z, w)
        } else maybeMirroredRotation = faceRotationQuat

        interactivity.emit(
          `faceLandmarks/change`,
          {
            translation: facePosition.toArray(),
            rotation: maybeMirroredRotation.toArray(),
            scale: faceScale.toArray(),
          },
          (node) => node.configuration.faceId === faceIndex,
        )

        controls?.target.copy(facePosition)

        if (options.onInfo && import.meta.env.DEV) {
          options.onInfo({
            scale,
            rotationToOrigin,
            facePosition,
            faceScale,
            faceRotationEuler: new THREE.Euler().setFromQuaternion(faceRotationQuat),
          })
        }
      }
    },
    onInitProgress: options.onInitProgress,
    onError: options.onError,
  })

  let rvfcHandle = -1
  const start = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', height: 720 } })
      video.srcObject = stream

      detector.init()

      await new Promise((resolve, reject) => {
        video.addEventListener('loadedmetadata', resolve, { once: true })
        video.addEventListener('error', reject, { once: true })
      })

      video.requestVideoFrameCallback(() => {
        const frame = new VideoFrame(video)
        const { primaries } = frame.colorSpace
        videoTexture.colorSpace = primaries === 'smpte170m' ? 'display-p3' : 'srgb'
        frame.close()
      })

      size.width = video.videoWidth
      size.height = video.videoHeight

      await video.play()

      renderer.setAnimationLoop(animate)

      const onVideoFrame: VideoFrameRequestCallback = () => {
        detector.detect(video).catch(options.onError)
        rvfcHandle = video.requestVideoFrameCallback(onVideoFrame)
      }
      rvfcHandle = video.requestVideoFrameCallback(onVideoFrame)

      return true
    } catch {
      return false
    }
  }

  const stop = () => {
    video.pause()
    video.srcObject = null
    detector.dispose()
    renderer.dispose()
    stream?.getTracks().forEach((track) => track.stop())
    video.cancelVideoFrameCallback(rvfcHandle)
  }

  const animate = () => {
    renderer.setSize(size.width, size.height, false)
    renderer.render(scene, camera)
  }

  const ar = {
    scene,
    camera,
    renderer,
    video,
    start,
    stop,
  }

  ;(window as unknown as Record<string, unknown>).ar = ar

  return ar
}
