import { computed, markRaw } from 'vue'

import type * as pub from '#core'

import type { VueDocument } from '../document-views/vue/vue-document.ts'

export class VueSelection implements pub.Selection {
  #doc: VueDocument
  #selection: pub.Selection

  readonly #nodes = computed(() => this.#selection.nodes.map((node) => this.#doc._getNode(node)))

  readonly #gaps = computed(() =>
    this.#selection.gaps.map((item): pub.GapSelection => {
      const node = this.#doc._getNode(item.node)

      return {
        node,
        isNode: false,
        get prev() {
          return node.prev
        },
        get next() {
          return node.next
        },
      }
    }),
  )

  readonly #items = computed(() => [...this.#nodes.value, ...this.#gaps.value])

  get nodes(): pub.AnyClip[] {
    return this.#nodes.value
  }

  get gaps(): pub.GapSelection[] {
    return this.#gaps.value
  }

  get items(): (pub.GapSelection | pub.AnyClip)[] {
    return this.#items.value
  }

  constructor(doc: VueDocument, original: pub.Selection) {
    this.#doc = doc
    this.#selection = original
    markRaw(this)
  }

  addNode(id: string): void {
    this.#selection.addNode(id)
  }
  addGap(id: string): void {
    this.#selection.addGap(id)
  }
  removeNode(id: string): void {
    this.#selection.removeNode(id)
  }
  removeGap(id: string): void {
    this.#selection.removeGap(id)
  }
  hasNode(id: string): boolean {
    return this.#selection.hasNode(id)
  }
  hasGap(id: string): boolean {
    return this.#selection.hasGap(id)
  }

  clear(): void {
    this.#selection.clear()
  }

  dispose(): void {
    this.#doc = this.#selection = undefined as never
  }
}
