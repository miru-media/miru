---
layout: page
title: Video Editor
sidebar: false
pageClass: demo-page
---

<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import * as base64 from 'base64-js'
import { uid } from 'uid'
import { useRouter } from 'vitepress'
import { useI18n } from 'vue-i18n-lite'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'

import { demoDoc } from '../../packages/app-video-editor/src/demo-document'
import type { SerializedDocument } from '../../packages/webgl-video-editor/types/schema'
import { VideoEditorYjsStore } from 'webgl-video-editor/store/yjs.js'
import { INITIAL_DOC_UPDATE_BASE64 } from './video-editor-demo-store'
import { YTREE_YMAP_KEY } from 'webgl-video-editor/store/constants.js'

const router = useRouter()
const { t } = useI18n()

const projects = import.meta.env.SSR ? [] as never: useLocalStorage<{ name: string; id: string, createdAt: string }[]>('video-editor-docs', [])

const createDoc = async (name = 'Untitled', content?: SerializedDocument) => {
  const id = uid()
  
  if (content) {
    const ydoc = new Y.Doc()
    Y.applyUpdateV2(ydoc, base64.toByteArray(INITIAL_DOC_UPDATE_BASE64))

    VideoEditorYjsStore.initYmapsFromJson({
      tree: ydoc.getMap(YTREE_YMAP_KEY),
      settings: ydoc.getMap('settings'),
      assets: ydoc.getMap('assets')
    }, content)

    const idb = new IndexeddbPersistence(id, ydoc)
    try {
      await idb.whenSynced
    } finally {
      ydoc.destroy()
      await idb.destroy()
    }
  }

  projects.value.push({ name, id, createdAt: new Date().toISOString() })
  await router.go(getDocUrl(id))
}

const onClickDelete = async (id: string) => {
  if (!window.confirm(t('confirm_delete_project'))) return

  await new IndexeddbPersistence(id, new Y.Doc()).clearData()
  projects.value = projects.value.filter(p => p.id !== id)
}

const getDocUrl = (id: string) => `/video-editor/project?id=${id}`
</script>

<div class="root bulma-container">
  <div class="bulma-columns columns-container">
    <div class="bulma-column">
      <div class="bulma-content">
        <h1 class="text-center mb-4">Projects</h1>
      </div>
      <ClientOnly>
        <ul class="project-list">
          <li v-for="{ id, name, createdAt } of projects" :key="id" class="project-list-item">
            <a :href="getDocUrl(id)" class="project-card">
              <div>{{ name }}</div>
              <div class="text-[0.75em]">{{ new Date(createdAt).toLocaleString() }}</div>
            </a>
            <button class="project-delete" @click="() => onClickDelete(id)">
              <div class="i-tabler:trash" />
              <div class="sr-only">{{ $t('delete') }}</div>
            </button>
          </li>
        </ul>
      </ClientOnly>
    </div>
    <div class="bulma-column">
      <div class="flex gap-1rem flex-col">
        <img alt="Video editing illustration" src="../branding/illustrations/2.svg" class="bulma-is-hidden-mobile max-w-20rem m-auto">
        <button @click="() => createDoc()" class="create-button">
          <div class="i-tabler:plus" />
          {{ $t('create_empty_project') }}
        </button>
        <button @click="() => createDoc('Example', demoDoc)" class="create-button">
          <div class="i-tabler:plus" />
          {{ $t('create_example_project') }}
        </button>
      </div>
    </div>
  </div>
</div>

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
  display:flex;
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
