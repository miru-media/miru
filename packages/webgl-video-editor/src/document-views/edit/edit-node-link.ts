import { computed, ref } from 'fine-jsx'

import type * as pub from '#core'
import type { Schema } from '#core'

import type { ViewType } from '../document-view.ts'

import type { EditDocument, ViewTypeMap } from './edit-document.ts'

export namespace EditNodeLink {
  export type Linkable = pub.AnyTrack | pub.AnyClip
}

export class EditNodeLink<T extends EditNodeLink.Linkable = EditNodeLink.Linkable>
  implements Schema.NodeLink
{
  doc: EditDocument
  nodeIds = ref<string[]>([])
  id: string

  readonly #nodes = computed(() =>
    this.nodeIds.value.map((n) => this.doc.nodes.get<ViewType<ViewTypeMap, T>>(n)),
  )

  get nodes(): ViewType<ViewTypeMap, T>[] {
    return this.#nodes.value
  }

  constructor(doc: EditDocument, init: Schema.NodeLink) {
    this.doc = doc
    this.id = init.id
    this.nodeIds.value = init.nodes.map((n) => n.id)
  }

  dispose(): void {
    this.doc = undefined as never
  }
}
