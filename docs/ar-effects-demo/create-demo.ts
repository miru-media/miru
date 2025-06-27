import { GLTFFaceLandmarkDetectionExtension, GLTFInteractivityExtension } from 'gltf-interactivity/three'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'

import envHdr from 'shared/assets/textures/equirectangular/venice_sunset_1k.hdr'

const MIRROR = true as boolean

export const createDemo = (options: {
  onInitProgress: (progress: number) => void
  onError: (error: unknown) => void
  onInfo?: (info: unknown) => void
  assetUrl: string
}) => {
  const canvas = document.createElement('canvas')
  const renderer = new THREE.WebGLRenderer({ canvas })
  const scene = new THREE.Scene()

  const video = document.createElement('video')
  video.playsInline = video.muted = true

  // https:github.com/google-ai-edge/mediapipe/blob/232008b/mediapipe/tasks/cc/vision/face_geometry/face_geometry_from_landmarks_graph.cc#L71
  const camera = new THREE.PerspectiveCamera(63, 1, 1, 10_000)

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

  const interactivity = new GLTFInteractivityExtension()
  const faceLandmarksDetector = new GLTFFaceLandmarkDetectionExtension({
    ...options,
    onDetect(faceTransforms) {
      contentGroup.visible = faceTransforms.length > 0
    },
  })

  // load glTF asset with interactivity extensions
  new GLTFLoader()
    .register((parser) => interactivity.init(parser))
    .register((parser) => faceLandmarksDetector.init(parser))
    .loadAsync(options.assetUrl)
    .then((result) => contentGroup.add(result.scene))
    .catch(options.onError)

  // load environment texture
  new RGBELoader()
    .loadAsync(envHdr)
    .then((texture) => {
      scene.environment = new THREE.PMREMGenerator(renderer).fromEquirectangular(texture).texture
    })
    .catch(options.onError)

  // set video background texture
  const videoTexture = new THREE.VideoTexture(video)
  videoTexture.colorSpace = 'srgb'
  if (MIRROR) {
    videoTexture.wrapS = THREE.RepeatWrapping
    videoTexture.repeat.x = -1
  }
  scene.background = videoTexture

  // set camera aspect ratio and canvas size to match video
  video.addEventListener('loadedmetadata', () => {
    const { videoWidth, videoHeight } = video

    camera.aspect = videoWidth / videoHeight
    camera.updateProjectionMatrix()
    renderer.setSize(videoWidth, videoHeight, false)
  })

  let stream: MediaStream | undefined

  // get camera video stream
  // start face landmarks detection
  // start renderer animation loop
  const start = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', height: 720 } })
      video.srcObject = stream

      await Promise.all([faceLandmarksDetector.start(video), video.play()])

      renderer.setAnimationLoop(() => renderer.render(scene, camera))

      return true
    } catch {
      return false
    }
  }

  const stop = () => {
    video.pause()
    video.srcObject = null
    renderer.dispose()
    stream?.getTracks().forEach((track) => track.stop())
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
