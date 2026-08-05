<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { uid } from 'uid'
import { useI18n } from 'vue-i18n-lite'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'

import type { Schema } from 'webgl-video-editor'
import { YjsSync } from 'webgl-video-editor/yjs'
import { VideoEditorDocList } from 'app-video-editor'
import { useRouter } from 'vue-router'
import type { DocListItem } from '../../../packages/app-video-editor/src/video-editor-doc-list.vue'
import { thumbnailStorage } from './thumbnail-storage.ts'

const router = useRouter()
const { t } = useI18n()

const projects = import.meta.env.SSR
  ? ([] as never)
  : useLocalStorage<Omit<DocListItem, 'url'>[]>('video-editor-docs', [])

const openDoc = (doc: DocListItem, event: Event) => {
  event.preventDefault()
  router.push(getDocUrl(doc.id))
}

const createDoc = async (name = t('untitled'), content?: Schema.SerializedDocument) => {
  const id = uid()

  if (content) {
    const ydoc = new Y.Doc()

    const thumbnailUri = content.assets.find(
      (a) => a.type === 'asset:media:av' && !!a.thumbnailUri,
    )?.thumbnailUri

    if (thumbnailUri) {
      fetch(thumbnailUri)
        .then((res) => res.body && thumbnailStorage.setImage(id, res.body))
        .catch(() => undefined)
    }

    YjsSync.initYmapFromJson({ root: ydoc, assetsYmap: ydoc.getMap('assets'), content })

    const idb = new IndexeddbPersistence(id, ydoc)
    try {
      await idb.whenSynced
    } finally {
      ydoc.destroy()
      await idb.destroy()
    }
  }

  const createdAt = new Date().toISOString()
  projects.value.push({ name, id, createdAt, updatedAt: createdAt })
  await router.push(getDocUrl(id))
}

const onDelete = async (id: string) => {
  if (!window.confirm(t('confirm_delete_project'))) return

  await new IndexeddbPersistence(id, new Y.Doc()).clearData()
  projects.value = projects.value.filter((p) => p.id !== id)
}

const getDocUrl = (id: string) => `/project/?id=${id}`
</script>

<template>
  <VideoEditorDocList
    :docs="
      projects.map((p) => ({
        ...p,
        url: '/video-editor' + getDocUrl(p.id),
        thumbnail: thumbnailStorage.get(p.id),
      }))
    "
    @open="openDoc"
    @create="createDoc"
    @delete="onDelete"
  >
    <template #header-start>
      <a href="/" class="nav-brand mt-[-6px] px-2 flex-shrink-0" :title="$t('back')">
        <span class="sr-only">{{ $t('back') }}</span>
        <img
          src="../../../website/content/media/logo/white-logo.svg"
          style="width: auto; height: 28px"
          alt=""
        />
      </a>
    </template>
  </VideoEditorDocList>
</template>
