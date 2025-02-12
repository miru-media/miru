import { effect, type Ref, ref } from 'fine-jsx'
import { uid } from 'uid'
import { getDefaultFilterDefinitions } from 'webgl-effects'

import { Effect } from 'reactive-effects/Effect'
import { type Mp4ContainerInfo } from 'shared/transcode/demuxer'
import { type Size } from 'shared/types'
import { useElementSize } from 'shared/utils'
import { remap0 } from 'shared/utils/math'

import { Clip } from './Clip'
import { MIN_CLIP_DURATION_S } from './constants'
import { Movie } from './Movie'
import { Track } from './Track'
import { type ClipSnapshot, type HistoryOp, type MediaElementInfo } from './types'
import { checkAndWarnVideoFile, getContainerInfo, getMediaElementInfo } from './utils'

const getClipAtTime = (track: Track<Clip>, time: number) => {
  for (let clip = track.head; clip; clip = clip.next) {
    const clipTime = clip.time

    if (clipTime.start <= time && time < clipTime.end) return clip
  }
}

interface MediaSourceEntry {
  url: string
  refCount: 0
  blob?: Blob
  infoPromise: Promise<Mp4ContainerInfo>
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
  #mediaSources = new Map<string, MediaSourceEntry>()
  effects: Ref<Map<string, Effect>>

  showStats = ref(false)
  exportResult = ref<{ blob: Blob; url: string }>()
  exportProgress = ref(-1)

  #objects = new Map<string, Track<Clip> | Clip>()
  #isLoading = ref(false)

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

      const { actions, index, canUndo, canRedo } = this.#history

      if (ops.length === 1 && canUndo.value) {
        const op = ops[0]
        const prevAction = actions[actions.length - 1]
        const prevOp = prevAction[prevAction.length - 1]

        if (op.to && op.group && op.group === prevOp.group && op.to.id === prevOp.to?.id) {
          prevOp.to = op.to
          return
        }
      }

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

      this.#history.ignore(() => {
        ops.forEach((op) => {
          const { from, to } = op

          if (redo) {
            // create
            if (!from) this.#addClip(this.#objects.get(to.trackId) as Track<Clip>, to.clip, to)
            // delete
            else if (!to) this.#deleteClip(this.#objects.get(from.id) as Clip)
            // udpate
            else (this.#objects.get(from.id) as Clip).restoreFromSnapshot(to, this.effects.value)
          } else {
            // delete created
            if (!from) this.#deleteClip(this.#objects.get(to.id) as Clip)
            // recreate deleted
            else if (!to) this.#addClip(this.#objects.get(from.trackId) as Track<Clip>, from.clip, from)
            // revert udpate
            else (this.#objects.get(from.id) as Clip).restoreFromSnapshot(from, this.effects.value)
          }
        })
      })

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

  get selected() {
    return this.#selected.value
  }
  get isLoading() {
    return this.#isLoading.value
  }

  constructor(
    initialState: { resolution: Size; frameRate: number } = {
      resolution: { width: 1280, height: 720 },
      frameRate: 60,
    },
  ) {
    this.movie = new Movie({
      tracks: [],
      resolution: initialState.resolution,
      frameRate: initialState.frameRate,
    })
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

  async replaceMovie(movieInit: Movie.Init) {
    const { movie } = this

    this.#history.reset()

    movie.tracks.value.forEach((track) => {
      track.forEachClip((clip) => {
        this.#objects.delete(clip.id)
        this.#decrementMediaSource(clip.url)
      })
      track.dispose()
      this.#objects.delete(track.id)
    })

    movie.resolution = movieInit.resolution
    movie.frameRate.value = movieInit.frameRate

    try {
      this.#isLoading.value = true

      movie.tracks.value = await this.#history.ignore(() =>
        Promise.all(
          movieInit.tracks.map(async (trackInit) => {
            const track = new Track<Clip>({ ...trackInit, clips: [] }, movie, Clip)
            this.#objects.set(track.id, track)

            const clips = await Promise.all(
              trackInit.clips.map(async (clipInit) =>
                this.#withMediaSourceInfo(clipInit.source, (mediaInfo) =>
                  this.#addClip(
                    track,
                    { ...clipInit, sourceMetadata: mediaInfo.video },
                    { index: undefined, skipInsert: true },
                  ),
                ),
              ),
            )

            clips.forEach((clip) => track.pushSingleClip(clip))

            return track
          }),
        ),
      )
    } finally {
      this.#isLoading.value = false
    }
  }

  async addClip(track: Track<Clip>, source: string | Blob) {
    if (typeof source !== 'string' && !checkAndWarnVideoFile(track.type, source)) return

    await this.#withMediaSourceInfo(source, (mediaInfo, url) => {
      const { duration } = mediaInfo
      this.#history.batch(() => {
        this.#addClip(
          track,
          {
            id: uid(),
            source: url,
            sourceStart: 0,
            duration,
            sourceMetadata: mediaInfo.video,
          },
          { skipInsert: true },
        )
      })
    })
  }

  async #withMediaSourceInfo<T>(
    source: string | Blob,
    fn: (
      info: Mp4ContainerInfo | (MediaElementInfo & { audio: undefined; video: undefined }),
      url: string,
    ) => T,
  ) {
    const { url, infoPromise } = this.#incrementMediaSource(source)

    try {
      let info

      try {
        info = await infoPromise
      } catch {
        info = {
          ...(await getMediaElementInfo(url)),
          audio: undefined,
          video: undefined,
        }
      }
      return await fn(info, url)
    } finally {
      this.#decrementMediaSource(url)
    }
  }

  #addClip(track: Track<Clip>, init: Clip.Init, options: { index?: number; skipInsert?: boolean }) {
    const { index, skipInsert } = options
    const clip = track.createClip(init)

    this.#incrementMediaSource(init.source)
    this.#objects.set(clip.id, clip)

    if (!skipInsert) {
      track.pushSingleClip(clip)
      if (index != undefined) track.positionClipAt(clip, index)
    }

    this.#history.add([{ type: 'clip:update', from: undefined, to: clip.getSnapshot() }])

    return clip
  }

  async replaceClipSource(source: string | Blob) {
    const clip = this.selected
    if (!clip || (typeof source !== 'string' && !checkAndWarnVideoFile(clip.track.type, source))) return

    await this.#withMediaSourceInfo(source, (mediaInfo, url) => {
      const from = clip.getSnapshot()
      this.#decrementMediaSource(clip.media.value.src)
      clip.duration.value = Math.min(mediaInfo.duration, clip.duration.value)
      clip.setMedia(url, mediaInfo.video)

      this.#history.add([{ type: 'clip:update', from, to: clip.getSnapshot() }])
    })
  }

  splitAtCurrentTime() {
    this.#history.batch(() => this.#splitAtCurrentTime())
  }

  #splitAtCurrentTime() {
    const { currentTime } = this.movie
    const trackOfSelectedClip = this.selected?.track

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
    const prevClipTime = clip.time
    const delta = currentTime - prevClipTime.start

    if (delta < MIN_CLIP_DURATION_S) return

    const undoFrom = clip.getSnapshot()

    this.#addClip(
      clip.track,
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

    this.#incrementMediaSource(clip.media.value.src)
    this.select(clip)

    this.#history.add([{ type: 'clip:update', from: undoFrom, to: clip.getSnapshot() }])
  }

  #deleteClip(clip: Clip) {
    this.#history.add([{ type: 'clip:update', from: clip.getSnapshot(), to: undefined }])

    this.#selected.value = undefined
    this.#decrementMediaSource(clip.media.value.src)
    this.#objects.delete(clip.id)
    clip.track.deleteClip(clip)
    clip.dispose()
  }

  delete() {
    const clip = this.selected
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
          to: (this.#objects.get(snapshot.id) as Clip).getSnapshot(),
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
          to: (this.#objects.get(snapshot.id) as Clip).getSnapshot(),
        }),
    )
    this.#history.add(ops)

    this.resize.value = undefined
  }

  setFilter(clip: Clip, filter: Effect | undefined, intensity: number) {
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
    const entry = this.#mediaSources.get(url) ?? {
      url,
      refCount: 0,
      blob,
      infoPromise: getContainerInfo(url),
    }
    entry.refCount++
    this.#mediaSources.set(url, entry)

    return entry
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
