import { type Ref, ref } from 'fine-jsx'
import VideoContext from 'videocontext'
import { type Renderer } from 'webgl-effects'

import { setObjectSize } from 'shared/utils'

import { type NodeMap } from '../../types/internal'
import { type Movie } from '../nodes'
import { ParentNode } from '../nodes/ParentNode'
import { Track } from '../nodes/Track'

import { ExtractorClip } from './ExporterClip'

export type TrackMovie = Pick<
  Movie,
  'id' | 'nodes' | 'videoContext' | 'renderer' | 'resolution' | 'frameRate' | 'isPaused' | 'isStalled'
>

export class ExportMovie extends ParentNode {
  type = 'movie' as const
  children: Track<ExtractorClip>[]
  declare parent: undefined
  declare root: this
  nodes: NodeMap
  videoContext: VideoContext
  renderer: Renderer
  resolution: { width: number; height: number }
  frameRate: Ref<number>
  isPaused: Ref<boolean>
  isStalled: Ref<boolean>
  duration: number
  gl: WebGL2RenderingContext

  constructor(movie: Movie) {
    super(movie.id, undefined)
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

    this.children = movie.children.map((track_) => new Track(track_.toObject(), this, ExtractorClip))

    this.onDispose(() => {
      this.children.forEach((track) => track.dispose())
      this.videoContext.reset()
      this.videoContext.destination.destroy()
    })
  }
}
