import envHdr from 'https://raw.github.com/mrdoob/three.js/master/examples/textures/equirectangular/venice_sunset_1k.hdr'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { DeviceOrientationControls } from 'three-stdlib'

import { type EnvInfo, EnvMatcher } from './match-environment'
import {
  DETECTION_CAMERA_FAR,
  DETECTION_CAMERA_FOV,
  DETECTION_CAMERA_NEAR,
  GLTFFaceLandmarkDetectionExtension,
  GLTFInteractivityExtension,
} from './three'
import { GLTFMeshOccluderExtension } from './three/loaders/miru-mesh-occluder'

const MIRROR = true as boolean
const ENV_MATCH_INTERVAL_MS = 10_000
const ENV_INTENSITY_UPDATE_INTERVAL_MS = 200

class EffectPlayerEvent extends Event {
  progress?: number
  error: unknown
  info: unknown

  constructor(type: 'progress', progress: number)
  constructor(type: 'error' | 'info', arg: unknown)
  constructor(type: 'progress' | 'error' | 'info', arg: unknown) {
    super(type)

    if (type === 'progress') this.progress = arg as number
    else if (type === 'error') this.error = arg
    else this.info = arg
  }
}

export class EffectPlayer {
  canvas: HTMLCanvasElement
  renderer: THREE.WebGLRenderer
  contentGroup = new THREE.Group()
  scene = new THREE.Scene().add(this.contentGroup)
  animationMixer = new THREE.AnimationMixer(this.scene)
  environmentOptions: EnvInfo[] | undefined

  video = document.createElement('video')
  videoTexture = new THREE.VideoTexture(this.video)
  stream?: MediaStream
  camera = new THREE.PerspectiveCamera(DETECTION_CAMERA_FOV, 1, DETECTION_CAMERA_NEAR, DETECTION_CAMERA_FAR)
  deviceOrientationControls = new DeviceOrientationControls(this.camera)
  controls?: OrbitControls

  startTimeS = 0
  prevTimeS = 0

  interactivity?: GLTFInteractivityExtension
  faceLandmarksDetector?: GLTFFaceLandmarkDetectionExtension

  #canvasTrack?: MediaStreamTrack
  #recorder?: MediaRecorder

  readonly #intervalHandles: (NodeJS.Timeout | number)[] = []

  get isRecording(): boolean {
    return !!this.#recorder
  }

  readonly #recorderChunks: Blob[] = []

  readonly #eventTarget = new EventTarget()

  constructor(options: { canvas?: HTMLCanvasElement; environmentOptions?: EnvInfo[] } = {}) {
    this.canvas = options.canvas ?? document.createElement('canvas')
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas })
    this.environmentOptions = options.environmentOptions

    const { video, scene, camera, canvas } = this
    video.playsInline = video.muted = true

    if (import.meta.env.DEV) {
      const controls = (this.controls = new OrbitControls(camera, canvas))
      controls.zoomToCursor = true
      controls.target.set(0, 0, -1)
      controls.update()

      scene.add(new THREE.GridHelper())
      scene.add(new THREE.AxesHelper())
    }
  }

  async loadEffect(source: string | ArrayBuffer): Promise<void> {
    const { renderer, scene, contentGroup, camera, animationMixer, videoTexture, video } = this

    this.interactivity = new GLTFInteractivityExtension()
    this.faceLandmarksDetector = new GLTFFaceLandmarkDetectionExtension({
      onError: this.#onError.bind(this),
      onInitProgress: this.#onInitProgress.bind(this),
    })

    // load environment texture
    const environmentPromise = new RGBELoader()
      .loadAsync(envHdr)
      .then((texture) => {
        scene.environment = new THREE.PMREMGenerator(renderer).fromEquirectangular(texture).texture
      })
      .catch(this.#onError.bind(this))

    // load glTF asset with interactivity extensions
    const loader = new GLTFLoader()
      .register((parser) => new GLTFMeshOccluderExtension(parser))
      .register(this.interactivity.init.bind(this.interactivity))
      .register(this.faceLandmarksDetector.init.bind(this.faceLandmarksDetector))

    const gltfPromise = (
      typeof source === 'string' ? loader.loadAsync(source) : loader.parseAsync(source, '')
    ).then((result) => {
      contentGroup.add(result.scene)

      result.animations.forEach((clip) => animationMixer.clipAction(clip).play())
    })

    // set video background texture
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

    await Promise.all([environmentPromise, gltfPromise])
  }

  // get camera video stream
  // start face landmarks detection
  // start renderer animation loop
  async init(): Promise<void> {
    const { interactivity } = this

    if (!interactivity) throw new Error('Not initialized')

    const { renderer, scene, camera, animationMixer, videoTexture, video } = this
    const videoConstraints = { facingMode: 'user', height: 720 }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: true })
    } catch {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false })
    }

    video.srcObject = this.stream

    // Set video texture on face meshes with "projected" uvMode
    const faceMesh = scene.getObjectByName('face0-mesh')
    if (faceMesh instanceof THREE.Mesh && faceMesh.userData.useVideoTexture === true) {
      const texture = new THREE.VideoTexture(video)
      texture.flipY = false
      texture.colorSpace = videoTexture.colorSpace
      ;(faceMesh.material as THREE.MeshStandardMaterial).map = texture
    }

    const { deviceOrientationControls } = this
    deviceOrientationControls.addEventListener('change', () => scene.quaternion.copy(camera.quaternion))

    await Promise.all([this.faceLandmarksDetector!.start(video), video.play()])

    renderer.setAnimationLoop((timeMs) => {
      if (video.paused) return

      const timeS = timeMs / 1000
      const timeSinceLastTick = timeS - this.prevTimeS
      const timeSinceStart = timeS - this.startTimeS

      {
        const { type, alpha } = deviceOrientationControls.deviceOrientation
        if (!type || alpha == null)
          deviceOrientationControls.deviceOrientation = { alpha: 0, beta: 90, gamma: 0 }
      }

      deviceOrientationControls.update()
      if (this.isRecording) interactivity.emit('event/onTick', { timeSinceStart, timeSinceLastTick })
      animationMixer.update(timeSinceLastTick)

      renderer.render(scene, camera)
      this.prevTimeS = timeS
    })

    const { environmentOptions } = this
    if (environmentOptions && environmentOptions.length > 0) {
      const envMatcher = new EnvMatcher({ environmentOptions })

      if (envMatcher.debug) {
        this.canvas.parentNode?.parentNode?.appendChild(envMatcher.debug.element)
      }

      const textureLoader = new THREE.TextureLoader()

      envMatcher.addEventListener('change', () => {
        if (!envMatcher.result) return

        const { closestEnv, lightnessRatio } = envMatcher.result

        textureLoader
          .loadAsync(closestEnv.url)
          .then((texture) => {
            scene.environment = new THREE.PMREMGenerator(renderer).fromEquirectangular(texture).texture
            scene.environmentIntensity = lightnessRatio
          })
          .catch(this.#onError.bind(this))
      })
      envMatcher.matchImage(video)

      this.#intervalHandles.push(
        setInterval(envMatcher.matchImage.bind(envMatcher, video), ENV_MATCH_INTERVAL_MS),
      )
      this.#intervalHandles.push(
        setInterval(() => {
          scene.environmentIntensity = envMatcher.updateLightnessRatio(video)
        }, ENV_INTENSITY_UPDATE_INTERVAL_MS),
      )
    }
  }

  async play(): Promise<void> {
    const { interactivity } = this
    if (!interactivity) throw new Error('Not initialized')
    await this.video.play()

    this.prevTimeS = this.startTimeS = performance.now() / 1000
    interactivity.emit('event/onStart', {})
  }

  pause(): void {
    this.video.pause()
  }

  startRecording(): void {
    const { stream, interactivity } = this
    if (!stream || !interactivity) throw new Error('Video playback not yet started')

    const canvasStream = this.canvas.captureStream()
    this.#canvasTrack = canvasStream.getVideoTracks()[0]

    const tracks = [canvasStream.getTracks()[0], ...stream.getAudioTracks()]

    try {
      this.#recorder = new MediaRecorder(new MediaStream(tracks), { mimeType: 'video/mp4' })
    } catch {
      this.#recorder = new MediaRecorder(new MediaStream(tracks), { mimeType: 'video/webm' })
    }

    this.prevTimeS = this.startTimeS = performance.now() / 1000
    interactivity.emit('event/onStart', {})
    interactivity.emit('event/onTick', { timeSinceStart: 0, timeSinceLastTick: 0 })
    this.renderer.render(this.scene, this.camera)

    this.#recorder.ondataavailable = (event) => this.#recorderChunks.push(event.data)
    this.#recorder.start()
  }

  async stopRecording(): Promise<Blob> {
    const recorder = this.#recorder
    if (!recorder) throw new Error(`Recording wasn't started`)

    await new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve()
      recorder.onerror = reject
      recorder.stop()
    })

    const blob = new Blob(this.#recorderChunks, { type: recorder.mimeType })

    this.#recorderChunks.length = 0
    this.#canvasTrack?.stop()

    return blob
  }

  addEventListener(
    type: 'progress' | 'error' | 'info',
    listener: (event: EffectPlayerEvent) => void,
    options?: AddEventListenerOptions,
  ): void {
    this.#eventTarget.addEventListener(type, listener as any, options)
  }

  #onInitProgress(progress: number): void {
    this.#eventTarget.dispatchEvent(new EffectPlayerEvent('progress', progress))
  }

  #onError(error: unknown): void {
    this.#eventTarget.dispatchEvent(new EffectPlayerEvent('error', error))
  }

  dispose(): void {
    const { video, renderer, stream } = this
    video.pause()
    video.srcObject = null
    renderer.dispose()
    stream?.getTracks().forEach((track) => track.stop())
    this.#intervalHandles.forEach(clearInterval)
  }
}
