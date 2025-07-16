import {
  DETECTION_CAMERA_FAR,
  DETECTION_CAMERA_FOV,
  DETECTION_CAMERA_NEAR,
  GLTFFaceLandmarkDetectionExtension,
  GLTFInteractivityExtension,
} from 'gltf-interactivity/three'
import envHdr from 'https://raw.github.com/mrdoob/three.js/master/examples/textures/equirectangular/venice_sunset_1k.hdr'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { DeviceOrientationControls } from 'three-stdlib'

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

  const camera = new THREE.PerspectiveCamera(
    DETECTION_CAMERA_FOV,
    1,
    DETECTION_CAMERA_NEAR,
    DETECTION_CAMERA_FAR,
  )

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
  const start = async (): Promise<boolean> => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', height: 720 } })
      video.srcObject = stream

      await Promise.all([faceLandmarksDetector.start(video), video.play()])

      // Set video texture on face meshes with "projected" uvMode
      const faceMesh = scene.getObjectByName('face0-mesh')
      if (faceMesh instanceof THREE.Mesh && faceMesh.userData.useVideoTexture === true) {
        const texture = new THREE.VideoTexture(video)
        texture.flipY = false
        texture.colorSpace = videoTexture.colorSpace
        ;(faceMesh.material as THREE.MeshStandardMaterial).map = texture
      }

      const deviceOrientationControls = new DeviceOrientationControls(camera)
      deviceOrientationControls.addEventListener('change', () => scene.quaternion.copy(camera.quaternion))

      renderer.setAnimationLoop(() => {
        {
          const { type, alpha } = deviceOrientationControls.deviceOrientation
          if (!type || alpha == null)
            deviceOrientationControls.deviceOrientation = { alpha: 0, beta: 90, gamma: 0 }
        }

        deviceOrientationControls.update()

        renderer.render(scene, camera)
      })

      return true
    } catch {
      return false
    }
  }

  const stop = (): void => {
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
