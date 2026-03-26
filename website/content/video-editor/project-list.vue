<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import * as base64 from 'base64-js'
import { uid } from 'uid'
import { useI18n } from 'vue-i18n-lite'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'

import type { Schema } from 'webgl-video-editor'
import { YjsSync } from 'webgl-video-editor/yjs'
import { INITIAL_DOC_UPDATE_BASE64 } from './video-editor-demo-store'
import { VideoEditorDocList } from 'app-video-editor'
import { useRouter } from 'vue-router'
import type { DocListItem } from '../../../packages/app-video-editor/src/video-editor-doc-list.vue'

const router = useRouter()
const { t } = useI18n()

const projects = import.meta.env.SSR
  ? ([] as never)
  : useLocalStorage<Omit<DocListItem, 'url'>[]>('video-editor-docs', [])

const openDoc = (doc: DocListItem, event: Event) => {
  event.preventDefault()
  router.push(getDocUrl(doc.id))
}

const createDoc = async (name = 'Untitled', content?: Schema.SerializedDocument) => {
  const id = uid()

  if (content) {
    const ydoc = new Y.Doc()
    Y.applyUpdateV2(ydoc, base64.toByteArray(INITIAL_DOC_UPDATE_BASE64))

    YjsSync.initYmapFromJson({ root: ydoc, assetsYmap: ydoc.getMap('assets'), content })

    const idb = new IndexeddbPersistence(id, ydoc)
    try {
      await idb.whenSynced
    } finally {
      ydoc.destroy()
      await idb.destroy()
    }
  }

  projects.value.push({ name, id, createdAt: new Date().toISOString() })
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
    :docs="projects.map((p) => ({ ...p, url: '/video-editor' + getDocUrl(p.id) }))"
    @open="openDoc"
    @create="createDoc"
    @delete="onDelete"
  />
</template>

<style scoped>
.root {
  color-scheme: dark;
  color: var(--white-3);
  padding-top: 1rem;
}

.columns-container {
  margin: 0;
}

.project-list {
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.project-list-item {
  display: flex;
  align-items: center;
  gap: 2rem;
  width: 100%;
  font-size: 1.5rem;
}

.project-card,
.create-button {
  display: flex;
  gap: 0.675rem;
  flex-grow: 1;
  color: var(--white-3);
  border-color: gray;
  border-radius: 0.625rem;
  padding: 0.675rem 0.875rem;
  text-decoration: none;
}

.create-button {
  align-items: center;
  justify-content: center;
  border-style: dashed;
  border-width: 0.1875rem;
  font-size: 1.25rem;
  background-color: rgb(255 255 255 / 3%);
}

.project-card {
  flex-direction: column;
  border-style: solid;
  background-color: rgb(29 107 228 / 10%);
  border-color: rgb(29 107 228 / 40%);

  outline-color: rgb(29 107 228);
}

.project-delete {
  border-radius: 0.25rem;
  font-size: 1.75rem;

  &:focus-visible {
    outline: solid currentColor;
  }
}
</style>
