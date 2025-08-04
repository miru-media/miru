import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DeviceOrientationControls } from 'three-stdlib'

import {
  DETECTION_CAMERA_FAR,
  DETECTION_CAMERA_FOV,
  DETECTION_CAMERA_NEAR,
  GLTFFaceLandmarkDetectionExtension,
  GLTFInteractivityExtension,
} from './three/index.ts'
import { GLTFMeshOccluderExtension } from './three/loaders/miru-mesh-occluder.ts'

const MIRROR = true as boolean

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
  readonly textureLoader = new THREE.TextureLoader()
  readonly #pmremGenerator: THREE.PMREMGenerator

  video: HTMLVideoElement
  videoTexture = new THREE.VideoFrameTexture()
  camera = new THREE.PerspectiveCamera(DETECTION_CAMERA_FOV, 1, DETECTION_CAMERA_NEAR, DETECTION_CAMERA_FAR)
  deviceOrientationControls = new DeviceOrientationControls(
    new THREE.Object3D() as DeviceOrientationControls['object'],
  )
  controls?: OrbitControls

  startTimeS = 0
  prevTimeS = 0

  interactivity?: GLTFInteractivityExtension
  faceLandmarksDetector?: GLTFFaceLandmarkDetectionExtension

  #canvasTrack?: MediaStreamTrack
  #recorder?: MediaRecorder
  #effectScene?: THREE.Group

  #wasReplaced = false

  get isRecording(): boolean {
    return !!this.#recorder
  }

  readonly #recorderChunks: Blob[] = []

  readonly #eventTarget = new EventTarget()
  readonly #onVideoLoaded = this.#updateCanvasSize.bind(this)

  constructor(options: {
    video: HTMLVideoElement
    canvas?: HTMLCanvasElement
    renderer?: THREE.WebGLRenderer
  }) {
    // @ts-expect-error for debugging
    if (import.meta.env.DEV) window.player = this

    this.video = options.video
    this.canvas = options.canvas ?? document.createElement('canvas')
    this.renderer = options.renderer ?? new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true })
    this.#pmremGenerator = new THREE.PMREMGenerator(this.renderer)

    const { scene, camera, canvas } = this

    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1

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
    const { scene, contentGroup, animationMixer, videoTexture, video } = this

    this.interactivity = new GLTFInteractivityExtension()
    this.faceLandmarksDetector = new GLTFFaceLandmarkDetectionExtension({
      onInitProgress: this.#onInitProgress.bind(this),
      onProcess: this.#onProcess.bind(this),
      onError: this.#onError.bind(this),
      getState: () => ({ cameraRotation: this.deviceOrientationControls.object.quaternion.toArray() }),
    })

    // load environment texture
    this.#setEnvironmentMap()

    // load glTF asset with interactivity extensions
    const loader = new GLTFLoader()
      .register((parser) => new GLTFMeshOccluderExtension(parser))
      .register(this.interactivity.init.bind(this.interactivity))
      .register(this.faceLandmarksDetector.init.bind(this.faceLandmarksDetector))

    const gltfPromise = (
      typeof source === 'string' ? loader.loadAsync(source) : loader.parseAsync(source, '')
    ).then((result) => {
      this.#effectScene = result.scene
      contentGroup.add(result.scene)

      if (result.scene.userData.disableEnvironmentLighting === true) {
        this.scene.environment = null
      }

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
    if (video.readyState >= video.HAVE_METADATA) this.#onVideoLoaded()
    else video.addEventListener('loadedmetadata', this.#onVideoLoaded, { once: true })

    await gltfPromise
  }

  // start face landmarks detection
  // start renderer animation loop
  async start(): Promise<void> {
    const { interactivity } = this

    if (!interactivity) throw new Error('Not initialized')

    const { renderer, scene, camera, animationMixer, videoTexture, video } = this

    // Set video texture on face meshes with "projected" uvMode
    const faceMesh = scene.getObjectByName('face0-mesh')
    if (faceMesh instanceof THREE.Mesh && faceMesh.userData.useVideoTexture === true) {
      const texture = new THREE.VideoTexture(video)
      texture.flipY = false
      texture.colorSpace = videoTexture.colorSpace
      ;(faceMesh.material as THREE.MeshStandardMaterial).map = texture
    }

    const { deviceOrientationControls } = this

    await Promise.all([this.faceLandmarksDetector!.start(video), video.play().catch(() => undefined)])

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
  }

  #setEnvironmentMap(): void {
    const { scene } = this

    if (this.#effectScene?.userData.disableEnvironmentLighting === true) {
      scene.environment = null
      return
    }

    const env = new RoomEnvironment()
    scene.environment = this.#pmremGenerator.fromScene(env).texture
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

  startRecording(audioTracks: MediaStreamTrack[] = []): void {
    const { interactivity } = this
    if (!interactivity) throw new Error('Video playback not yet started')

    this.#canvasTrack = this.canvas.captureStream().getVideoTracks()[0]
    const tracks = [this.#canvasTrack, ...audioTracks]

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

  removeEventListener(
    type: 'progress' | 'error' | 'info',
    listener: (event: EffectPlayerEvent) => void,
    options?: AddEventListenerOptions,
  ): void {
    this.#eventTarget.removeEventListener(type, listener as any, options)
  }

  #updateCanvasSize() {
    const { camera, renderer, video } = this
    const { videoWidth, videoHeight } = video

    camera.aspect = videoWidth / videoHeight
    camera.updateProjectionMatrix()
    renderer.setSize(videoWidth, videoHeight, false)
  }

  #onInitProgress(progress: number): void {
    this.#eventTarget.dispatchEvent(new EffectPlayerEvent('progress', progress))
  }

  #onProcess({ image, state }: { image: VideoFrame; state: unknown }) {
    ;(this.videoTexture.image as Partial<VideoFrame> | undefined)?.close?.()
    const { cameraRotation } = state as { cameraRotation: THREE.QuaternionTuple }

    this.scene.quaternion.fromArray(cameraRotation)
    this.camera.quaternion.fromArray(cameraRotation)

    this.videoTexture.setFrame(image)
  }

  #onError(error: unknown): void {
    this.#eventTarget.dispatchEvent(new EffectPlayerEvent('error', error))
  }

  async replaceWithNewPlayer(source: string | ArrayBuffer): Promise<EffectPlayer> {
    this.#wasReplaced = true

    const newPlayer = new EffectPlayer(this)
    await newPlayer.loadEffect(source)
    await newPlayer.start()

    this.dispose()

    return newPlayer
  }

  dispose(): void {
    this.video.removeEventListener('loadedmetadata', this.#onVideoLoaded)
    this.#pmremGenerator.dispose()
    this.controls?.dispose()
    this.deviceOrientationControls.dispose()
    this.interactivity?.dispose()
    this.faceLandmarksDetector?.dispose()
    this.animationMixer.stopAllAction()
    this.#recorder?.stop()
    this.#canvasTrack?.stop()
    this.#recorderChunks.length = 0
    ;(this.videoTexture.image as Partial<VideoFrame> | undefined)?.close?.()
    this.videoTexture.dispose()

    this.#recorder = this.#canvasTrack = undefined
    this.interactivity = this.faceLandmarksDetector = undefined

    if (!this.#wasReplaced) this.renderer.dispose()
  }
}
