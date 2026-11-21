import {
  computed,
  inject,
  type MaybeRefOrGetter,
  onScopeDispose,
  provide,
  type Ref,
  ref,
  toValue,
} from 'fine-jsx'

import type * as pub from '#core'
import type { AnyClip } from '#core'
import { Rational, useEventListener } from 'shared/utils/index.ts'

import type { VideoEditor } from '../video-editor.ts'

const VIDEO_EDITOR_CONTEXT = Symbol('video-editor-context')
const IMPORT_MEDIA_FILES_CONTEXT = Symbol('import-media-files-context')

export type ImportMediaBin = 'video' | 'audio'

export const useEditor = (): VideoEditor => inject<VideoEditor>(VIDEO_EDITOR_CONTEXT)!
export const provideEditor = (editor: VideoEditor): void => provide(VIDEO_EDITOR_CONTEXT, editor)

export const useImportMediaFiles = (): ((bin: ImportMediaBin) => Promise<File[]>) | undefined =>
  inject(IMPORT_MEDIA_FILES_CONTEXT)
export const provideImportMediaFiles = (importMediaFiles?: (bin: ImportMediaBin) => Promise<File[]>): void =>
  provide(IMPORT_MEDIA_FILES_CONTEXT, importMediaFiles)

export const ensureDurationIsPlayable = (clip: AnyClip): void => {
  const { asset } = clip
  if (asset?.type !== 'asset:media:av') return

  const docFrameRate = clip.doc.frameRate
  const sourceDuration = Rational.fromDecimal(asset.duration, docFrameRate)
  const durationOutsideClip = sourceDuration.subtract(clip.sourceStart.add(clip.duration))
  const { sourceStart } = clip
  clip.sourceStart = sourceStart.add(durationOutsideClip)

  clip.duration = Rational.min(clip.duration, sourceDuration)
}

export const getClipAtTime = (track: pub.AnyTrack, time: number): pub.AnyClip | undefined => {
  for (let clip = track.head; clip; clip = clip.next) {
    const { start, end } = clip.time
    if (start <= time && time < end) return clip
  }
}

export const useClipEdges = (editor: VideoEditor, node: Pick<pub.AnyClip, 'time'>) =>
  computed(() => {
    const { start, duration } = node.time
    const left = editor.secondsToPixels(start)
    const right = left + editor.secondsToPixels(duration)

    return { left, right }
  })

export const moveAndFillGaps = (
  node: pub.AnyClip,
  position: pub.ChildNodePosition,
  newStart: Rational,
  padEnd?: Rational,
) => {
  const nodeAtPosition = getNodeAtTargetPosition<pub.AnyClip>(node.doc, position)
  const nodeBeforePosition = nodeAtPosition
    ? nodeAtPosition.prev
    : node.doc.nodes.get<pub.AnyTrack>(position.parentId).children[position.index - 1]
  const newNextNode = node === nodeAtPosition ? node.next : nodeAtPosition
  const newPrevClipEnd = nodeBeforePosition?.timeRational.end ?? Rational.ZERO

  const startGap = Rational.max(newStart.subtract(newPrevClipEnd), Rational.ZERO)
  let endGap =
    newNextNode?.timeRational.start
      .subtract(Rational.max(newStart, newPrevClipEnd))
      .subtract(node.duration) ?? Rational.ZERO
  endGap = Rational.max(padEnd ? endGap.add(padEnd) : endGap, Rational.ZERO)

  // fill gap at old position
  node.next?.setGap(
    node.prev?.id,
    node.next.timeRational.start.subtract(node.prev?.timeRational.end ?? Rational.ZERO),
  )

  // set start gap at new position
  node.setGap(nodeBeforePosition?.id, startGap)
  // set end gap at new position
  newNextNode?.setGap(node.id, endGap)

  node.move(position)
}

export const nodeFitsBetween = (
  node: pub.AnyClip,
  a: pub.AnyClip | undefined,
  b: pub.AnyClip | undefined,
): boolean => !b || b.time.start - (a?.time.end ?? 0) >= node.duration.valueOf()

export const slideNodeBy = (node: pub.AnyClip, delta: Rational) => {
  const newGap = Rational.clamp(
    node.gap.add(delta),
    Rational.ZERO,
    node.next ? node.next.gap.add(node.gap) : Rational.INFINITY,
  )
  const deltaGap = newGap.subtract(node.gap)

  node.next?.setGap(node.id, node.next.gap.subtract(deltaGap))
  node.gap = newGap
}

export const getNodeAtTargetPosition = <T extends pub.AnyNode>(
  doc: pub.Document,
  position: pub.ChildNodePosition,
): T | undefined => doc.nodes.get<pub.AnyTrack>(position.parentId).children[position.index] as T

export const nodesAreLinked = (a: pub.Linkable, b: pub.Linkable): boolean =>
  a.id === b.id || !!(b.link && a.link?.id === b.link.id)

export const useDomDropzone = (
  target: MaybeRefOrGetter<Element | undefined>,
  options: {
    filter?: (item: DataTransferItem) => boolean
    onDragOver?: (event: DragEvent, items: DataTransferItem[]) => void
    onEnter?: (event: DragEvent, items: DataTransferItem[]) => void
    onLeave?: (event: DragEvent, items: DataTransferItem[]) => void
    onDrop: (event: DragEvent, items: DataTransferItem[]) => void
    onDragEnd?: (event: DragEvent) => void
  },
): { items: Ref<DataTransferItem[] | undefined>; isActive: Ref<boolean>; hasDrag: Ref<boolean> } => {
  const hasDrag = ref(false)
  const items = ref<DataTransferItem[]>()
  const isActive = computed(() => (items.value?.length ?? 0) !== 0)
  const filterItems = (item: DataTransferItem) => (options.filter ? options.filter(item) : true)
  const updateItems = (event: DragEvent) => {
    const { dataTransfer } = event
    const newItems = dataTransfer ? [...dataTransfer.items].filter(filterItems) : []
    return (items.value = newItems.length ? newItems : undefined)
  }
  const clearItems = (): void => {
    items.value = undefined
    hasDrag.value = false
  }
  const onEnd = (event: DragEvent): void => {
    if (items.value) options.onDragEnd?.(event)
    clearItems()
    hasDrag.value = false
  }

  useEventListener(window, 'dragenter', (event: DragEvent) => {
    event.preventDefault()
    updateItems(event)
  })
  useEventListener(target, 'dragover', (event: DragEvent) => {
    event.preventDefault()
    items.value && options.onDragOver?.(event, items.value)
  })
  useEventListener(window, 'dragover', (event: DragEvent) => {
    if (!items.value) return

    const contains = toValue(target)?.contains(event.target as Element)

    if (contains) {
      if (!hasDrag.value) {
        options.onEnter?.(event, items.value)
        hasDrag.value = true
      }
    } else if (hasDrag.value) {
      options.onLeave?.(event, items.value)
      hasDrag.value = false
    }
  })
  useEventListener(target, 'drop', (event: DragEvent) => {
    event.preventDefault()
    const items = updateItems(event)

    if (!items) return
    if (items.length > 0) options.onDrop(event, items)

    onEnd(event)
  })

  useEventListener(window, 'dragend', onEnd)
  onScopeDispose(clearItems)

  return { items, isActive, hasDrag }
}

export const importMediaFiles = async (
  editor: pub.VideoEditor,
  files: File[],
  translate: (s: string) => string,
) => {
  const results = await Promise.allSettled(files.map((file) => editor.createMediaAsset(file)))

  if (results.some((result) => result.status === 'rejected'))
    // eslint-disable-next-line no-alert -- TODO
    alert(translate('error_cannot_play_type'))

  return results
}
