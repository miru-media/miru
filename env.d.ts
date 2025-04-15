/* eslint-disable @typescript-eslint/consistent-type-imports */
/// <reference types="vite/client" />
/// <reference types="./auto-imports" />

// remote assets
declare module 'https://*.webm' {
  const src: string
  export default src
}
declare module 'https://*.mp4' {
  const src: string
  export default src
}
declare module 'https://*.mp3' {
  const src: string
  export default src
}

declare module 'virtual:*-shadow.css' {
  const src: string
  export default src
}

declare module '*.vert' {
  const src: string
  export default src
}
declare module '*.frag' {
  const src: string
  export default src
}
declare module '*.glsl' {
  const src: string
  export default src
}

declare module '*.vue' {
  const component: import('vue').Component
  export default component
}

declare module 'postcss-url' {}
declare module 'postcss-import' {}
declare module 'postcss-hover-media-feature' {}
declare module 'eslint-plugin-import' {
  const val: any
  export = val
}

declare module 'mp4box' {}

declare module 'videocontext' {
  interface EffectDefinition {
    title: string
    description: string
    vertexShader: string
    fragmentShader: string
    properties: Record<string, { type: 'uniform' | 'attribute'; value: any }>
    inputs: string[]
  }

  interface Connection {
    source: SourceNode
    type: 'zIndex' | 'name'
    zIndex?: number
    name?: string
    destination: GraphNode
  }

  class RenderGraph {
    connections: Connection[]
    getOutputsForNode(node: GraphNode): GraphNode[]
    getNamedInputsForNode(node: GraphNode): GraphNode[]
    getZIndexInputsForNode(node: GraphNode): Connection[]
    getInputsForNode(node: GraphNode): GraphNode[]
    isInputAvailable(node: GraphNode): boolean
    registerConnection(sourceNode: GraphNode, destinationNode: GraphNode, target: string | number): boolean
    unregisterConnection(sourceNode: GraphNode, destinationNode: GraphNode): boolean
    static outputEdgesFor(node: GraphNode, connections: Connection[]): Connection[]
    static inputEdgesFor(node: GraphNode, connections: Connection[]): Connection[]
    static getInputlessNodes(connections: Connection[]): GraphNode[]
  }

  class GraphNode {
    constructor(
      gl: WebGLRenderingContext,
      renderGraph: RenderGraph,
      inputNames: string[],
      limitConnections: boolean,
    )
    get inputs(): GraphNode[]
    get outputs(): GraphNode[]
    get destroyed(): boolean
    connect(targetNode: GraphNode, targetPort?: string | number): boolean
    disconnect(targetNode?: GraphNode): boolean
    destroy(): void
    protected _gl: WebGLRenderingContext
    protected _displayName: string
  }

  class DestinationNode extends GraphNode {}

  class SourceNode extends GraphNode {
    constructor(
      src: string | MediaStream | TexImageSource | undefined,
      gl: WebGLRenderingContext,
      renderGraph: RenderGraph,
      currentTime: number,
    )
    get state(): number
    get startTime(): number
    get stopTime(): number
    start(time: number): boolean
    startAt(time: number): boolean
    stop(time: number): boolean
    stopAt(time: number): boolean
    clearTimelineState(): void

    protected _element?: MediaStream | TexImageSource
    protected _currentTime: number
    protected _startTime: number
    protected _stopTime: number
    _isReady(): boolean
    _update(currentTime: number, triggerTextureUpdate: boolean): boolean
    _seek(time: number): void
    protected _unload(): void
    _ready: boolean
    protected _isElementPlaying: boolean
    protected _loadTriggered: boolean
  }

  class CanvasNode extends SourceNode {}
  class ImageNode extends SourceNode {}
  class MediaNode extends SourceNode {
    constructor(
      src: string | HTMLMediaElement | MediaStream,
      gl: WebGL2RenderingContext,
      renderGraph: RenderGraph,
      currentTime: number,
      playbackRate?: number,
      sourceOffset?: number,
      preloadTime?: number,
      mediaElementCache?: any,
      options?: Record<string, unknown>,
    )
    src: string | HTMLMediaElement | MediaStream
    _sourceOffset: number
  }

  class VideoNode extends MediaNode {
    get duration(): number
  }
  class AudioNode extends MediaNode {
    get duration(): number
  }

  class ProcessorNode<T extends Record<string, unknown>> extends GraphNode {
    setProperty<K extends keyof T>(name: K, value: T[K]): void
    getProperty<K extends keyof T>(name: K): T[K]
    _update(currentTime: number): void
    _seek(currentTime: number): void
    protected _render(): void
  }

  class CompositingNode<T extends Record<string, unknown>> extends ProcessorNode<T> {}

  class EffectNode<T extends Record<string, unknown>> extends ProcessorNode<T> {}

  class TransitionNode<T extends Record<string, unknown>> extends EffectNode<T> {
    transition<K extends keyof T>(
      startTime: number,
      endTime: number,
      currentValue: T[K],
      targetValue: T[K],
      propertyName: K,
    ): boolean
    transitionAt<K extends keyof T>(
      startTime: number,
      endTime: number,
      currentValue: T[K],
      targetValue: T[K],
      propertyName: K,
    ): boolean
    clearTransition(propertyName: string, time: number): boolean
    clearTransitions(propertyName?: string): boolean
  }

  export type { RenderGraph, GraphNode, VideoNode, CompositingNode, TransitionNode }

  export default class VideoContext {
    constructor(
      canvas: HTMLCanvasElement | OffscreenCanvas,
      initErrorCallback?: () => unknown,
      options?: {
        manualUpdate?: boolean
        endOnLastSourceEnd?: boolean
        useVideoElementCache?: boolean
        videoElementCacheSize?: number
        webglContextAttributes?: Record<string, unknown>
      },
    )

    destination: DestinationNode
    currentTime: number
    get state(): number

    video(
      src: string | HTMLVideoElement | MediaStream,
      sourceOffset?: number,
      preloadTime?: number,
      videoElementAttributes?: Record<string, unknown>,
    ): VideoNode
    audio(
      src: string | HTMLAudioElement | MediaStream,
      sourceOffset?: number,
      preloadTime?: number,
      audioElementAttributes?: Record<string, unknown>,
    ): AudioNode
    customSourceNode<T extends GraphNode>(
      // eslint-disable-next-line @typescript-eslint/prefer-function-type
      CustomSourceNode: { new (...args: any[]): T },
      ...args: unknown[]
    ): T
    compositor<T extends Record<string, any>>(definition: EffectDefinition): CompositingNode<T>
    transition<T extends Record<string, any>>(...args: any[]): TransitionNode<T>

    pause(): boolean
    play(): boolean
    update(dt: number): void
    registerCallback(type: string, func: (currentTime: number) => unknown): void
    reset(): void

    _update(dt: number): void

    static EVENTS: {
      UPDATE: 'update'
      STALLED: 'stalled'
      ENDED: 'ended'
      CONTENT: 'content'
      NOCONTENT: 'nocontent'
    }

    static NODES: {
      AudioNode: typeof AudioNode
      CanvasNode: typeof CanvasNode
      ImageNode: typeof ImageNode
      MediaNode: typeof MediaNode
      SourceNode: typeof SourceNode
      VideoNode: typeof VideoNode
      // patched
      GraphNode: typeof GraphNode
    }

    static DEFINITIONS: {
      AAF_VIDEO_SCALE: EffectDefinition
      CROSSFADE: EffectDefinition
      DREAMFADE: EffectDefinition
      HORIZONTAL_WIPE: EffectDefinition
      VERTICAL_WIPE: EffectDefinition
      RANDOM_DISSOLVE: EffectDefinition
      STATIC_DISSOLVE: EffectDefinition
      STATIC_EFFECT: EffectDefinition
      TO_COLOR_AND_BACK: EffectDefinition
      STAR_WIPE: EffectDefinition
      COMBINE: EffectDefinition
      COLORTHRESHOLD: EffectDefinition
      MONOCHROME: EffectDefinition
      HORIZONTAL_BLUR: EffectDefinition
      VERTICAL_BLUR: EffectDefinition
      AAF_VIDEO_CROP: EffectDefinition
      AAF_VIDEO_POSITION: EffectDefinition
      AAF_VIDEO_FLIP: EffectDefinition
      AAF_VIDEO_FLOP: EffectDefinition
      OPACITY: EffectDefinition
      CROP: EffectDefinition
    }
  }
}
