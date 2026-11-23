import { computed, ref, type Ref } from 'fine-jsx'

import type * as pub from '#core'

import type { EditDocument } from './document-views/edit/edit-document.ts'
import type { EditView } from './document-views/edit/edit-nodes.ts'

export class Selection implements pub.Selection {
  static NODE = 0
  static GAP = 1

  #doc: EditDocument
  readonly #nodeIds = ref(new Set<string>())
  readonly #gapIds = ref(new Set<string>())

  readonly #nodes = computed(() =>
    [...this.#nodeIds.value]
      .map((id) => this.#doc.nodes.get<pub.AnyClip>(id) as EditView.AnyClip | undefined)
      .filter((n) => !!n),
  )
  readonly #gaps = computed(() =>
    [...this.#gapIds.value]
      .map((id): pub.GapSelection | undefined => {
        const node = this.#doc.nodes.get<pub.AnyClip>(id) as EditView.AnyClip | undefined

        return (
          node && {
            node,
            isNode: false,
            get prev() {
              return node.prev
            },
            get next() {
              return node.next
            },
          }
        )
      })
      .filter((i) => !!i),
  )
  readonly #items = computed(() => [...this.#nodes.value, ...this.#gaps.value])

  get nodes(): EditView.AnyClip[] {
    return this.#nodes.value
  }
  get gaps(): pub.GapSelection[] {
    return this.#gaps.value
  }
  get items(): (pub.GapSelection | EditView.AnyClip)[] {
    return this.#items.value
  }

  readonly #linkedNodeIds = computed(() => this.#getLinkedIds(Selection.NODE))
  readonly #linkedGapIds = computed(() => this.#getLinkedIds(Selection.GAP))

  get linkedNodeIds(): Set<string> {
    return this.#linkedNodeIds.value
  }
  get linkedGapIds(): Set<string> {
    return this.#linkedGapIds.value
  }

  constructor(doc: EditDocument) {
    this.#doc = doc
  }

  addNode(id: string, seek = true): void {
    this.#add(Selection.NODE, id)

    if (seek) {
      const doc = this.#doc
      const node = doc.nodes.get<pub.AnyClip>(id)
      const { start, end } = node.time

      if (doc.currentTime < start) doc.seekTo(start)
      else if (doc.currentTime >= end) doc.seekTo(end - 1 / doc.frameRate)
    }
  }
  addGap(id: string): void {
    this.#add(Selection.GAP, id)
  }
  removeNode(id: string): void {
    this.#remove(Selection.NODE, id)
  }

  removeGap(id: string): void {
    this.#remove(Selection.GAP, id)
  }
  hasNode(id: string): boolean {
    return this.#has(Selection.NODE, id)
  }
  hasGap(id: string): boolean {
    return this.#has(Selection.GAP, id)
  }

  #getIdsRef(type: number): Ref<Set<string>> {
    return type === Selection.GAP ? this.#gapIds : this.#nodeIds
  }

  #add(type: number, id: string): void {
    const ids = this.#getIdsRef(type)
    const prev = ids.value
    if (!prev.has(id)) (ids.value = new Set(prev)).add(id)
  }

  #remove(type: number, id: string): void {
    const ids = this.#getIdsRef(type)
    const prev = ids.value
    if (prev.has(id)) (ids.value = new Set(prev)).delete(id)
  }

  #has(type: number, id: string): boolean {
    return this.#getIdsRef(type).value.has(id)
  }

  #getLinkedIds(type: number): Set<string> {
    const linkedIds = new Set<string>()
    this.#getIdsRef(type).value.forEach((id) => {
      const node = this.#doc.nodes.get<pub.AnyClip>(id) as pub.AnyClip | undefined
      if (node?.link) node.link.nodes.forEach((n) => void linkedIds.add(n.id))
      else linkedIds.add(id)
    })
    return linkedIds
  }

  clear(): void {
    this.#nodeIds.value = this.#gapIds.value = new Set()
  }

  dispose(): void {
    this.#doc = undefined as never
    this.clear()
  }
}
