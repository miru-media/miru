import { effect, type Ref, ref } from 'fine-jsx'
import { uid } from 'uid'
import { getDefaultFilterDefinitions } from 'webgl-effects'

import { Effect } from 'reactive-effects/Effect'
import { type Size } from 'shared/types'
import { useElementSize } from 'shared/utils'
import { remap0 } from 'shared/utils/math'

import { Clip } from './Clip'
import { Movie } from './Movie'
import { Track } from './Track'
import { type HistoryOp } from './types'
import { checkAndWarnVideoFile, getMediaInfo } from './utils'

const getClipAtTime = (track: Track<Clip>, time: number) => {
  for (let clip = track.head; clip; clip = clip.next) {
    const clipTime = clip.time

    if (clipTime.start < time && time < clipTime.end) return clip
  }
}

export class VideoEditor {
  movie: Movie

  selected = ref<Clip>()
  secondsPerPixel = ref(0.01)
  timelineSize = ref<Size>({ width: 1, height: 1 })
  canvasSize: Ref<Size>

  resize = ref<{ movieDuration: number }>()
  drag = ref({ isDragging: false, x: 0 })
  #mediaSources = new Map<string, { refCount: 0; blob?: Blob }>()
  effects: Ref<Map<string, Effect>>

  showStats = ref(false)
  exportResult = ref<{ blob: Blob; url: string }>()
  exportProgress = ref(-1)

  #objects = new Map<string, Track<Clip> | Clip>()

  #history = {
    actions: [] as HistoryOp[][],
    index: -1,
    pending: undefined as HistoryOp[] | undefined,
    noTrack: false,
    canUndo: ref(false),
    canRedo: ref(false),
    transaction: (fn: () => void) => {
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
      const { pending, noTrack, canUndo, canRedo } = this.#history
      if (noTrack) return

      if (pending) {
        pending.push(...ops)
        return
      }

      const { actions, index } = this.#history
      this.#history.index++
      const removedOps = actions.splice(index + 1, Infinity, ops).flat()

      ops.forEach((op) => {
        if (op.to) this.#incrementMediaSource(op.to.clip.source)
      })
      removedOps.forEach((op) => {
        if (op.to) this.#decrementMediaSource(op.to.clip.source)
      })

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

      this.#history.noTrack = true
      ops.forEach((op) => {
        const { from, to } = op

        if (redo) {
          // create
          if (!from) this.#addClip(this.#objects.get(to.trackId) as Track<Clip>, to.clip, to.index)
          // delete
          else if (!to) this.#deleteClip(this.#objects.get(from.id) as Clip)
          // udpate
          else (this.#objects.get(from.id) as Clip).restoreFromSnapshot(to, this.effects.value)
        } else {
          // delete created
          if (!from) this.#deleteClip(this.#objects.get(to.id) as Clip)
          // recreate deleted
          else if (!to) this.#addClip(this.#objects.get(from.trackId) as Track<Clip>, from.clip, from.index)
          // revert udpate
          else (this.#objects.get(from.id) as Clip).restoreFromSnapshot(from, this.effects.value)
        }
      })
      this.#history.noTrack = false

      canUndo.value = newIndex > -1
      canRedo.value = newIndex < actions.length - 1
    },
    reset: () => {
      this.#history.actions.length = 0
      this.#history.index = -1
    },
  }

  get canUndo() {
    return this.#history.canUndo.value
  }
  get canRedo() {
    return this.#history.canRedo.value
  }

  constructor(
    initialState: Movie.Init = {
      tracks: [],
      resolution: { width: 1280, height: 720 },
      frameRate: 60,
    },
  ) {
    this.movie = new Movie({
      tracks: [],
      resolution: initialState.resolution,
      frameRate: initialState.frameRate,
    })
    this.replaceMovie(initialState)
    this.canvasSize = useElementSize(this.movie.displayCanvas)
    this.effects = ref(
      new Map(
        getDefaultFilterDefinitions().map((def, i) => {
          const { id = i.toString() } = def
          return [id, new Effect({ ...def, id }, this.movie.renderer)]
        }),
      ),
    )

    effect(() => {
      const { movie } = this
      if (!movie.tracks.value.length) {
        movie.tracks.value = [new Track({ type: 'video', clips: [] }, movie, Clip)]
      }
    })
  }

  replaceMovie(movieInit: Movie.Init) {
    const { movie } = this
    movie.resolution = movieInit.resolution
    movie.frameRate.value = movieInit.frameRate
    movie.tracks.value.forEach((track) => track.dispose())
    movie.tracks.value = movieInit.tracks.map((init) => new Track(init, movie, Clip))

    this.movie.tracks.value.forEach((track) => {
      this.#objects.set(track.id, track)
      track.forEachClip((clip) => {
        this.#objects.set(clip.id, clip)
        this.#incrementMediaSource(clip.media.value.src)
      })
    })

    this.#history.reset()
  }

  async addClip(track: Track<Clip>, source: string | Blob) {
    if (typeof source !== 'string' && !checkAndWarnVideoFile(track.type, source)) return

    const { duration } = await getMediaInfo(source)
    this.#history.transaction(() => {
      this.#addClip(track, { id: uid(), source, sourceStart: 0, duration })
    })
  }

  #addClip(track: Track<Clip>, init: Omit<Clip.Init, 'source'> & { source: string | Blob }, index?: number) {
    const url = this.#incrementMediaSource(init.source)
    const clip = track.createClip({ ...init, source: url })

    track.pushSingleClip(clip)
    this.#objects.set(clip.id, clip)

    if (index != undefined) track.positionClipAt(clip, index)

    this.#history.add([{ type: 'clip:update', from: undefined, to: clip.getSnapshot() }])

    return clip
  }

  async replaceClipSource(source: string | Blob) {
    const clip = this.selected.value
    if (!clip) return
    if (typeof source !== 'string' && !checkAndWarnVideoFile(clip.track.type, source)) return

    const { duration } = await getMediaInfo(source)

    const url = this.#incrementMediaSource(source)
    this.#decrementMediaSource(clip.media.value.src)
    clip.duration.value = Math.min(duration, clip.duration.value)
    clip.setMedia(url)
  }

  splitAtCurrentTime() {
    this.#history.transaction(() => this.#splitAtCurrentTime())
  }

  #splitAtCurrentTime() {
    const { currentTime } = this.movie
    const trackOfSelectedClip = this.selected.value?.track

    // first search the track that contains a selected clip
    let clip = trackOfSelectedClip && getClipAtTime(trackOfSelectedClip, currentTime)

    if (!clip) {
      // then search all tracks for a clip at the current time
      for (const track of this.movie.tracks.value) {
        clip = getClipAtTime(track, currentTime)
        if (clip) break
      }
    }

    if (!clip) return

    const undoFrom = clip.getSnapshot()
    const delta = currentTime - clip.time.start
    const prevClipTime = clip.time

    this.#addClip(
      clip.track,
      {
        ...clip.toObject(),
        id: uid(),
        sourceStart: prevClipTime.source + delta,
        duration: prevClipTime.duration - delta,
        source: clip.media.value.src,
      },
      clip.next?.index,
    )

    clip.transition = undefined
    clip.duration.value = delta

    this.#incrementMediaSource(clip.media.value.src)
    this.selectClip(clip)

    this.#history.add([{ type: 'clip:update', from: undoFrom, to: clip.getSnapshot() }])
  }

  #deleteClip(clip: Clip) {
    this.#history.add([{ type: 'clip:update', from: clip.getSnapshot(), to: undefined }])

    this.selected.value = undefined
    this.#decrementMediaSource(clip.media.value.src)
    this.#objects.delete(clip.id)
    clip.track.deleteClip(clip)
    clip.dispose()
  }

  delete() {
    const clip = this.selected.value
    if (!clip) return

    this.#deleteClip(clip)
  }

  setTransition(_from: Clip, _to: Clip, _transition: Clip.Init['transition']) {
    throw new Error('Not Implemented.')
  }
  clearTransition(_from: Clip, _to: Clip) {
    throw new Error('Not Implemented.')
  }

  seekTo(time: number) {
    this.movie.seekTo(time)
  }

  selectClip(clip: Clip | undefined) {
    this.selected.value = clip
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
    try {
      const blob = await this.movie.export({
        onProgress: (value) => (this.exportProgress.value = value),
      })
      this.exportResult.value = { blob, url: URL.createObjectURL(blob) }
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

  #incrementMediaSource(source: string | Blob) {
    let url
    let blob
    if (typeof source === 'string') {
      url = source
      blob = undefined
    } else {
      url = URL.createObjectURL(source)
      blob = source
    }
    const entry = this.#mediaSources.get(url) ?? { refCount: 0, blob }
    entry.refCount++
    this.#mediaSources.set(url, entry)

    return url
  }

  #decrementMediaSource(url: string) {
    const entry = this.#mediaSources.get(url)
    if (!entry) return

    entry.refCount--

    if (entry.refCount <= 0) {
      this.#mediaSources.delete(url)
      if (entry.blob) URL.revokeObjectURL(url)
    }
  }
}
