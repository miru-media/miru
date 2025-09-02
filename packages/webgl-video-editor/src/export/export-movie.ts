import { type Ref, ref } from 'fine-jsx'
import VideoContext from 'videocontext'
import type { Renderer } from 'webgl-effects'

import { setObjectSize } from 'shared/utils'

import type { NodeMap } from '../../types/internal.ts'
import { Collection, type Movie, type Schema } from '../nodes/index.ts'
import { ParentNode } from '../nodes/parent-node.ts'
import { Track } from '../nodes/track.ts'

import { ExtractorClip } from './exporter-clip.ts'

export type TrackMovie = Pick<
  Movie,
  'id' | 'nodes' | 'videoContext' | 'renderer' | 'resolution' | 'frameRate' | 'isPaused' | 'isStalled'
>

export class ExportMovie extends ParentNode<Schema.Movie, Collection<'timeline'>> {
  type = 'movie' as const
  declare parent: never
  declare root: this
  timeline: Collection<'timeline'>
  nodes: NodeMap
  videoContext: VideoContext
  renderer: Renderer
  resolution: { width: number; height: number }
  frameRate: number
  isPaused: Ref<boolean>
  isStalled: Ref<boolean>
  duration: number
  gl: WebGL2RenderingContext

  constructor(movie: Movie) {
    super(movie.id)
    this.root = this

    const { gl } = movie
    const { canvas } = gl
    this.gl = gl

    canvas.getContext = () => gl as never
    setObjectSize(canvas, movie.resolution)
    this.videoContext = new VideoContext(canvas, undefined, { manualUpdate: true })
    delete (canvas as Partial<typeof canvas>).getContext

    this.nodes = movie.nodes
    this.renderer = movie.renderer
    this.resolution = movie.resolution
    this.frameRate = movie.frameRate
    this.duration = movie.duration
    this.isPaused = ref(false)
    this.isStalled = ref(false)

    this.timeline = new Collection(movie.timeline.toObject(), this)
    this.pushChild(this.timeline)

    movie.timeline.children.forEach((track_) => {
      const track = new Track(track_.toObject(), this)
      this.timeline.pushChild(track)
      track_.children.forEach((clip_) => {
        const clip = new ExtractorClip(clip_.toObject(), track)
        track.pushChild(clip)
      })
    })

    this.onDispose(() => {
      this.children.forEach((track) => track.dispose())
      this.videoContext.reset()
      this.videoContext.destination.destroy()
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/class-methods-use-this -- stub
  _emit(): void {}

  toObject(): Schema.Movie {
    return this.root.toObject()
  }
}
