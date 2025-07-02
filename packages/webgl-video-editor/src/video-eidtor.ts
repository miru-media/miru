import { computed, ref } from 'fine-jsx'
import { uid } from 'uid'

import type { Size } from 'shared/types'
import { remap0 } from 'shared/utils/math'
import { assertCanDecodeMediaFile, hasVideoDecoder } from 'shared/video/utils'

import type { ClipSnapshot, HistoryOp } from '../types/internal'

import { MIN_CLIP_DURATION_S } from './constants'
import { MovieExporter } from './export/movie-exporter'
import { Clip, MediaAsset, Movie, type Schema, Track, type VideoEffectAsset } from './nodes'

const getClipAtTime = (track: Track<Clip>, time: number) => {
  for (let clip = track.head; clip; clip = clip.next) {
    const clipTime = clip.time

    if (clipTime.start <= time && time < clipTime.end) return clip
  }
}

const INITIAL_SECONDS_PER_PIXEL = 0.01

export class VideoEditor {
  _movie: Movie

  readonly #selection = ref<Clip>()
  _secondsPerPixel = ref(INITIAL_SECONDS_PER_PIXEL)
  _timelineSize = ref<Size>({ width: 1, height: 1 })

  _resize = ref<{
    movieDuration: number
    from: [prev: ClipSnapshot | undefined, cur: ClipSnapshot, next: ClipSnapshot | undefined]
  }>()
  _drag = {
    from: undefined as
      | [prev: ClipSnapshot | undefined, cur: ClipSnapshot, next: ClipSnapshot | undefined]
      | undefined,
    isDragging: ref(false),
    x: ref(0),
  }

  get renderer() {
    return this._movie.renderer
  }
  get canvas() {
    return this._movie.canvas
  }
  get currentTime() {
    return this._movie.currentTime
  }

  readonly #effects = computed(() => new Map(this._movie.effects.value?.map((effect) => [effect.id, effect])))
  get effects() {
    return this.#effects.value
  }

  _showStats = ref(false)

  readonly #exportResult = ref<{ blob: Blob; url: string }>()
  get exportResult() {
    return this.#exportResult.value
  }

  readonly #exportProgress = ref(-1)
  get exportProgress() {
    return this.#exportProgress.value
  }

  readonly #isLoading = ref(0)

  readonly #history = {
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

      const { nodes } = this._movie

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

  get selection() {
    return this.#selection.value
  }
  get isLoading() {
    return this.#isLoading.value > 0
  }

  get tracks() {
    return this._movie.children
  }

  constructor(
    options: { resolution: Size; frameRate: number } = {
      resolution: { width: 1920, height: 1080 },
      frameRate: 24,
    },
  ) {
    this._movie = new Movie({
      id: uid(),
      type: 'movie',
      assets: [],
      children: [],
      resolution: options.resolution,
      frameRate: options.frameRate,
    })

    this._movie.clearAllContent(false)
  }

  async #withLoading<T>(fn: () => Promise<T>): Promise<T> {
    this.#isLoading.value++
    return await fn().finally(() => this.#isLoading.value--)
  }

  async clearAllContentAndHistory() {
    await this.#withLoading(async () => {
      const { _movie: movie } = this

      this.selectClip(undefined)
      this.#history.reset()
      await movie.clearAllContent(true)
    })
  }

  async replaceContent(movieInit: Schema.Movie) {
    await this.#withLoading(async () => {
      const { _movie: movie } = this
      const { nodes } = movie

      this.#history.reset()
      movie.clearAllContent()
      this.selectClip(undefined)

      movie.resolution = movieInit.resolution
      movie.frameRate.value = movieInit.frameRate

      await this.#history.ignore(async () => {
        await Promise.all(
          movieInit.assets.map(async (assetInit) => {
            if (assetInit.type === 'video_effect_asset') {
              // TODO
              return
            }
            const asset = await MediaAsset.fromInit(assetInit, this._movie)
            return asset
          }),
        )

        const setNode = nodes.set.bind(nodes)

        movie.children = movieInit.children.map((trackInit) => {
          const track = new Track(trackInit, movie, Clip)
          nodes.set(track)

          track._forEachClip(setNode)
          return track
        })
      })
    })
  }

  async createMediaAsset(source: string | Blob): Promise<MediaAsset> {
    return await MediaAsset.fromSource(uid(), this._movie, source)
  }

  async addClip(track: Track<Clip>, source: string | Blob) {
    if (track.trackType === 'audio' && hasVideoDecoder()) await assertCanDecodeMediaFile(source)

    const asset = await MediaAsset.fromSource(uid(), this._movie, source)
    const { duration } = asset

    let clip!: Clip

    this.#history.batch(() => {
      clip = this.#addClip(
        track,
        { id: uid(), type: 'clip', source: { assetId: asset.id }, sourceStart: 0, duration },
        {},
      )
    })

    return clip
  }

  #addClip(track: Track<Clip>, init: Schema.Clip, options: { index?: number; skipInsert?: boolean }) {
    const { index, skipInsert } = options
    const clip = track.createClip(init)

    this._movie.nodes.set(clip)

    if (!skipInsert) {
      track.pushSingleClip(clip)
      if (index != null) track.positionClipAt(clip, index)
    }

    this.#history.add([{ type: 'clip:update', from: undefined, to: clip.getSnapshot() }])

    return clip
  }

  async replaceClipSource(source: string | Blob) {
    const clip = this.#selection.value
    if (!clip) return

    const asset = await MediaAsset.fromSource(uid(), this._movie, source)

    const from = clip.getSnapshot()
    clip.duration = Math.min(asset.duration, clip.duration)
    clip.setMedia(asset)

    this.#history.add([{ type: 'clip:update', from, to: clip.getSnapshot() }])
  }

  splitClipAtCurrentTime() {
    let newClip: Clip | undefined
    this.#history.batch(() => {
      newClip = this.#splitAtCurrentTime()
    })

    return newClip
  }

  #splitAtCurrentTime() {
    const { currentTime } = this._movie
    const trackOfSelectedClip = this.#selection.value?.parent

    // first search the track that contains a selected clip
    let clip = trackOfSelectedClip && getClipAtTime(trackOfSelectedClip, currentTime)

    if (!clip) {
      // then search all tracks for a clip at the current time
      for (const track of this._movie.children) {
        clip = getClipAtTime(track, currentTime)
        if (clip) break
      }
    }

    if (!clip) return
    const prevClipTime = clip.time
    const delta = currentTime - prevClipTime.start

    if (delta < MIN_CLIP_DURATION_S) return

    const undoFrom = clip.getSnapshot()

    const newClip = this.#addClip(
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
    clip.duration = delta

    this.#selectClip(clip, false)

    this.#history.add([{ type: 'clip:update', from: undoFrom, to: clip.getSnapshot() }])

    return newClip
  }

  #deleteClip(clip: Clip) {
    this.#history.add([{ type: 'clip:update', from: clip.getSnapshot(), to: undefined }])

    this.#selection.value = undefined
    this._movie.nodes.delete(clip.id)
    clip.parent.deleteClip(clip)
    clip.dispose()
  }

  deleteSelection() {
    const clip = this.#selection.value
    if (!clip) return

    this.#deleteClip(clip)
  }

  play() {
    this._movie.play()
  }
  pause() {
    this._movie.pause()
  }
  seekTo(time: number) {
    this._movie.seekTo(time)
  }

  selectClip(id: string | undefined, seek = true) {
    this.#selectClip(id ? this._movie.nodes.get<Clip>(id) : undefined, seek)
  }
  #selectClip(clip: Clip | undefined, seek: boolean) {
    this.#selection.value = clip

    if (clip && seek) {
      const { start, end } = clip.time
      const { _movie: movie } = this

      if (movie.currentTime < start) movie.seekTo(start)
      else if (movie.currentTime >= end) movie.seekTo(end - 1 / movie.frameRate.value)
    }
  }

  _startClipDrag(clip: Clip) {
    this._drag.isDragging.value = true
    this._drag.from = [clip.prev?.getSnapshot(), clip.getSnapshot(), clip.next?.getSnapshot()]
  }
  _endClipDrag() {
    const { isDragging, x, from } = this._drag
    isDragging.value = false

    const ops: HistoryOp[] = []
    from?.forEach(
      (snapshot) =>
        snapshot &&
        ops.push({
          type: 'clip:update',
          from: snapshot,
          to: this._movie.nodes.get<Clip>(snapshot.id).getSnapshot(),
        }),
    )

    this.#history.add(ops)
    x.value = 0
  }

  _startClipResize(clip: Clip) {
    const { _movie: movie } = this
    movie.pause()

    this._resize.value = {
      movieDuration: movie.duration,
      from: [clip.prev?.getSnapshot(), clip.getSnapshot(), clip.next?.getSnapshot()],
    }
  }
  _endClipResize() {
    const resize = this._resize.value
    if (!resize) return

    const ops: HistoryOp[] = []
    resize.from.forEach(
      (snapshot) =>
        snapshot &&
        ops.push({
          type: 'clip:update',
          from: snapshot,
          to: this._movie.nodes.get<Clip>(snapshot.id).getSnapshot(),
        }),
    )
    this.#history.add(ops)

    this._resize.value = undefined
  }

  setClipFilter(clip: Clip, filterId: string | undefined, intensity: number) {
    const from = clip.getSnapshot()
    const filter = filterId ? this._movie.nodes.get<VideoEffectAsset>(filterId) : undefined
    clip._setFiler(filter, intensity)
    this.#history.add([{ type: 'clip:update', group: 'filter', from, to: clip.getSnapshot() }])
  }

  secondsToPixels(time: number) {
    const timelineWidth = this._timelineSize.value.width
    return remap0(time, timelineWidth * this._secondsPerPixel.value, timelineWidth)
  }

  pixelsToSeconds(offset: number) {
    return offset * this._secondsPerPixel.value
  }

  toObject() {
    return this._movie.toObject()
  }

  async export() {
    this.#exportResult.value = undefined

    const onProgress = (value: number) => (this.#exportProgress.value = value)

    this._movie.pause()
    onProgress(0)

    try {
      const exporter = new MovieExporter(this._movie)

      await this._movie
        .withoutRendering(async () => {
          const blob = await exporter.start({ onProgress })
          this.#exportResult.value = { blob, url: URL.createObjectURL(blob) }
        })
        .finally(() => exporter.dispose())
    } catch (error) {
      // eslint-disable-next-line no-alert -- TODO
      alert(`Encountered an error while exporting: ${String(error)}`)
    } finally {
      this.#exportProgress.value = -1
    }

    return this.exportResult
  }

  undo() {
    this.#history.undoRedo(false)
  }

  redo() {
    this.#history.undoRedo(true)
  }

  dispose() {
    this._movie.dispose()
  }
}
