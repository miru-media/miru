import { effect, type Ref, ref } from 'fine-jsx'
import { uid } from 'uid'

import { type Size } from 'shared/types'
import { useElementSize } from 'shared/utils'
import { remap0 } from 'shared/utils/math'

import { MIN_CLIP_DURATION_S } from './constants'
import { MovieExporter } from './export/MovieExporter'
import { Clip, MediaAsset, Movie, type Schema, Track, type VideoEffectAsset } from './nodes'
import { type ClipSnapshot, type HistoryOp } from './types'
import { checkAndWarnVideoFile } from './utils'

const getClipAtTime = (track: Track<Clip>, time: number) => {
  for (let clip = track.head; clip; clip = clip.next) {
    const clipTime = clip.time

    if (clipTime.start <= time && time < clipTime.end) return clip
  }
}

export class VideoEditor {
  movie: Movie

  #selected = ref<Clip>()
  secondsPerPixel = ref(0.01)
  timelineSize = ref<Size>({ width: 1, height: 1 })
  canvasSize: Ref<Size>

  resize = ref<{
    movieDuration: number
    from: [prev: ClipSnapshot | undefined, cur: ClipSnapshot, next: ClipSnapshot | undefined]
  }>()
  drag = {
    from: undefined as
      | [prev: ClipSnapshot | undefined, cur: ClipSnapshot, next: ClipSnapshot | undefined]
      | undefined,
    isDragging: ref(false),
    x: ref(0),
  }
  get renderer() {
    return this.movie.renderer
  }

  showStats = ref(false)
  exportResult = ref<{ blob: Blob; url: string }>()
  exportProgress = ref(-1)

  #isLoading = ref(0)

  #history = {
    actions: [] as HistoryOp[][],
    index: -1,
    pending: undefined as HistoryOp[] | undefined,
    noTrack: 0,
    canUndo: ref(false),
    canRedo: ref(false),
    ignore: <T extends (() => void) | (() => Promise<unknown>)>(fn: T): ReturnType<T> => {
      this.#history.noTrack++
      const res = fn()

      if (res && 'then' in res) return res.finally(() => this.#history.noTrack--) as ReturnType<T>

      this.#history.noTrack--
      return res as ReturnType<T>
    },
    batch: (fn: () => void) => {
      if (this.#history.pending) {
        fn()
        return
      }

      const ops = (this.#history.pending = [])
      fn()
      this.#history.pending = undefined
      if (ops.length) this.#history.add(ops)
    },
    add: (ops: HistoryOp[]) => {
      const { pending, noTrack } = this.#history
      if (noTrack) return

      if (pending) {
        pending.push(...ops)
        return
      }

      const { actions, canUndo, canRedo } = this.#history

      if (ops.length === 1 && canUndo.value) {
        const op = ops[0]
        const prevAction = actions[actions.length - 1]
        const prevOp = prevAction[prevAction.length - 1]

        if (op.to && op.group && op.group === prevOp.group && op.to.id === prevOp.to?.id) {
          prevOp.to = op.to
          return
        }
      }
      actions.splice(this.#history.index + 1, Infinity, ops).flat()

      this.#history.index++
      canUndo.value = true
      canRedo.value = false
    },
    undoRedo: (redo: boolean) => {
      const { actions, canUndo, canRedo } = this.#history
      if (redo) {
        if (!canRedo.value) return
      } else if (!canUndo.value) return

      const currentIndex = this.#history.index
      const newIndex = currentIndex + (redo ? 1 : -1)

      const ops = actions[redo ? newIndex : currentIndex]
      this.#history.index = newIndex

      const { nodes } = this.movie

      this.#history.ignore(() => {
        ops.forEach((op) => {
          const { from, to } = op

          if (redo) {
            // create
            if (!from) this.#addClip(nodes.get(to.trackId), to.clip, to)
            // delete
            else if (!to) this.#deleteClip(nodes.get(from.id))
            // udpate
            else nodes.get<Clip>(from.id).restoreFromSnapshot(to)
          } else {
            // delete created
            if (!from) this.#deleteClip(nodes.get(to.id))
            // recreate deleted
            else if (!to) this.#addClip(nodes.get(from.trackId), from.clip, from)
            // revert udpate
            else nodes.get<Clip>(from.id).restoreFromSnapshot(from)
          }
        })
      })

      canUndo.value = newIndex > -1
      canRedo.value = newIndex < actions.length - 1
    },
    reset: () => {
      this.#history.actions.length = 0
      this.#history.index = -1
      this.#history.canRedo.value = this.#history.canUndo.value = false
    },
  }

  get canUndo() {
    return this.#history.canUndo.value
  }
  get canRedo() {
    return this.#history.canRedo.value
  }

  get selected() {
    return this.#selected.value
  }
  get isLoading() {
    return this.#isLoading.value > 0
  }

  constructor(
    initialState: { resolution: Size; frameRate: number } = {
      resolution: { width: 1920, height: 1080 },
      frameRate: 60,
    },
  ) {
    this.movie = new Movie({
      id: uid(),
      type: 'movie',
      assets: [],
      children: [],
      resolution: initialState.resolution,
      frameRate: initialState.frameRate,
    })
    this.canvasSize = useElementSize(this.movie.displayCanvas)

    effect(() => {
      const { movie } = this
      if (!movie.children.value.length) {
        movie.children.value = [
          new Track({ id: uid(), type: 'track', trackType: 'video', children: [] }, movie, Clip),
        ]
      }
    })
  }

  async #withLoading<T>(fn: () => Promise<T>): Promise<T> {
    this.#isLoading.value++
    return fn().finally(() => this.#isLoading.value--)
  }

  async clearAllContentAndHistory() {
    await this.#withLoading(async () => {
      const { movie } = this

      this.select(undefined)
      this.#history.reset()
      await movie.clearAllContent(true)
    })
  }

  async replaceMovie(movieInit: Schema.Movie) {
    await this.#withLoading(async () => {
      const { movie } = this
      const { nodes } = movie

      this.#history.reset()
      movie.clearAllContent()
      this.select(undefined)

      movie.resolution = movieInit.resolution
      movie.frameRate.value = movieInit.frameRate

      await this.#history.ignore(async () => {
        await Promise.all(
          movieInit.assets.map(async (assetInit) => {
            if (assetInit.type === 'video_effect_asset') {
              // TODO
              return
            }
            const asset = await MediaAsset.fromInit(assetInit)
            nodes.set(asset)
            movie.assets.add(asset)
            return asset
          }),
        )

        movie.children.value = movieInit.children.map((trackInit) => {
          const track = new Track(trackInit, movie, Clip)
          nodes.set(track)

          track.forEachClip((clip) => nodes.set(clip))
          return track
        })
      })
    })
  }

  async addClip(track: Track<Clip>, source: string | Blob) {
    if (typeof source !== 'string' && !checkAndWarnVideoFile(track.trackType, source)) return

    const asset = await MediaAsset.fromSource(uid(), source)
    const { duration } = asset

    this.movie.nodes.set(asset)
    this.movie.assets.add(asset)

    this.#history.batch(() => {
      this.#addClip(
        track,
        { id: uid(), type: 'clip', source: { assetId: asset.id }, sourceStart: 0, duration },
        {},
      )
    })
  }

  #addClip(track: Track<Clip>, init: Schema.Clip, options: { index?: number; skipInsert?: boolean }) {
    const { index, skipInsert } = options
    const clip = track.createClip(init)

    this.movie.nodes.set(clip)

    if (!skipInsert) {
      track.pushSingleClip(clip)
      if (index != undefined) track.positionClipAt(clip, index)
    }

    this.#history.add([{ type: 'clip:update', from: undefined, to: clip.getSnapshot() }])

    return clip
  }

  async replaceClipSource(source: string | Blob) {
    const clip = this.selected
    if (!clip) return

    const asset = await MediaAsset.fromSource(uid(), source)

    const from = clip.getSnapshot()
    clip.duration.value = Math.min(asset.duration, clip.duration.value)
    clip.setMedia(asset)

    this.#history.add([{ type: 'clip:update', from, to: clip.getSnapshot() }])
  }

  splitAtCurrentTime() {
    this.#history.batch(() => this.#splitAtCurrentTime())
  }

  #splitAtCurrentTime() {
    const { currentTime } = this.movie
    const trackOfSelectedClip = this.selected?.parent

    // first search the track that contains a selected clip
    let clip = trackOfSelectedClip && getClipAtTime(trackOfSelectedClip, currentTime)

    if (!clip) {
      // then search all tracks for a clip at the current time
      for (const track of this.movie.children.value) {
        clip = getClipAtTime(track, currentTime)
        if (clip) break
      }
    }

    if (!clip) return
    const prevClipTime = clip.time
    const delta = currentTime - prevClipTime.start

    if (delta < MIN_CLIP_DURATION_S) return

    const undoFrom = clip.getSnapshot()

    this.#addClip(
      clip.parent,
      {
        ...clip.toObject(),
        id: uid(),
        sourceStart: prevClipTime.source + delta,
        duration: prevClipTime.duration - delta,
      },
      { index: clip.next?.index },
    )

    clip.transition = undefined
    clip.duration.value = delta

    this.select(clip)

    this.#history.add([{ type: 'clip:update', from: undoFrom, to: clip.getSnapshot() }])
  }

  #deleteClip(clip: Clip) {
    this.#history.add([{ type: 'clip:update', from: clip.getSnapshot(), to: undefined }])

    this.#selected.value = undefined
    this.movie.nodes.delete(clip.id)
    clip.parent.deleteClip(clip)
    clip.dispose()
  }

  delete() {
    const clip = this.selected
    if (!clip) return

    this.#deleteClip(clip)
  }

  setTransition(_from: Clip, _to: Clip, _transition: Schema.Clip['transition']) {
    throw new Error('Not Implemented.')
  }
  clearTransition(_from: Clip, _to: Clip) {
    throw new Error('Not Implemented.')
  }

  seekTo(time: number) {
    this.movie.seekTo(time)
  }

  select(clip: Clip | undefined) {
    this.#selected.value = clip
  }

  startDrag(clip: Clip) {
    this.drag.isDragging.value = true
    this.drag.from = [clip.prev?.getSnapshot(), clip.getSnapshot(), clip.next?.getSnapshot()]
  }
  endDrag() {
    const { isDragging, x, from } = this.drag
    isDragging.value = false

    const ops: HistoryOp[] = []
    from?.forEach(
      (snapshot) =>
        snapshot &&
        ops.push({
          type: 'clip:update',
          from: snapshot,
          to: this.movie.nodes.get<Clip>(snapshot.id).getSnapshot(),
        }),
    )

    this.#history.add(ops)
    x.value = 0
  }

  startResize(clip: Clip) {
    const { movie } = this
    movie.pause()

    this.resize.value = {
      movieDuration: movie.duration,
      from: [clip.prev?.getSnapshot(), clip.getSnapshot(), clip.next?.getSnapshot()],
    }
  }
  endResize() {
    const resize = this.resize.value
    if (!resize) return

    const ops: HistoryOp[] = []
    resize.from.forEach(
      (snapshot) =>
        snapshot &&
        ops.push({
          type: 'clip:update',
          from: snapshot,
          to: this.movie.nodes.get<Clip>(snapshot.id).getSnapshot(),
        }),
    )
    this.#history.add(ops)

    this.resize.value = undefined
  }

  setFilter(clip: Clip, filter: VideoEffectAsset | undefined, intensity: number) {
    const from = clip.getSnapshot()
    clip.filter.value = filter
    clip.filterIntensity.value = intensity
    this.#history.add([{ type: 'clip:update', group: 'filter', from, to: clip.getSnapshot() }])
  }

  secondsToPixels(time: number) {
    const timelineWidth = this.timelineSize.value.width
    return remap0(time, timelineWidth * this.secondsPerPixel.value, timelineWidth)
  }

  pixelsToSeconds(offset: number) {
    return offset * this.secondsPerPixel.value
  }

  async startExport() {
    this.exportResult.value = undefined

    const onProgress = (value: number) => (this.exportProgress.value = value)

    this.movie.pause()
    onProgress(0)

    try {
      const exporter = new MovieExporter(this.movie)

      await this.movie.withoutRendering(async () => {
        const blob = await exporter.start({ onProgress }).finally(() => exporter.dispose())
        this.exportResult.value = { blob, url: URL.createObjectURL(blob) }
      })
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error)
      alert(`Encountered an error while exporting: ${String(error)}`)
    } finally {
      this.exportProgress.value = -1
    }
  }

  undo() {
    this.#history.undoRedo(false)
  }

  redo() {
    this.#history.undoRedo(true)
  }
}
