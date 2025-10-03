<script setup lang="ts">
import { customRef, markRaw, onScopeDispose, toRef } from 'vue'
import * as Y from 'yjs'
import VideoEditorDoc from './video-editor-doc.vue'
import { useBrowserLocation } from '@vueuse/core'

const { ydoc } = defineProps<{ ydoc: Y.Doc }>()

const location = useBrowserLocation()

const documents = customRef((track, trigger) => {
  const documents = markRaw(ydoc.getArray<Y.Doc>('documents'))

  documents.observe(trigger)
  onScopeDispose(() => documents.unobserve(trigger))

  return {
    get() {
      track()
      return documents
    },
    set() {
      throw new Error('Readonly')
    },
  }
})

const currentDoc = toRef((): Y.Doc | undefined => {
  for (const doc of documents.value) {
    if (doc.guid === location.value.hash?.slice(1)) return doc
  }
})

const createDoc = () => {
  const doc = new Y.Doc()
  documents.value.push([doc])
  openDoc(doc)
}

const openDoc = (doc: Y.Doc | undefined) => (location.value.hash = doc ? doc.guid : '')
</script>

<template>
  <div class="root">
    <Suspense v-if="currentDoc">
      <video-editor-doc :key="currentDoc.guid" :ydoc="currentDoc" />
    </Suspense>
    <div v-else class="projects">
      <ul>
        <li v-for="doc of documents">
          <a :href="'#' + doc.guid" class="project-item">Open doc {{ doc.guid }}</a>
        </li>
      </ul>
      <button @click="createDoc" class="project-item">
        <span class="i-tabler:plus" />
        {{ $t('create_project') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.root {
  --primary-bg: #171717;
  background-color: var(--primary-bg);
  height: 100vh;
  color-scheme: dark;
}

.projects {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.project-item {
  display: flex;
  align-items: center;
  cursor: pointer;
  background-color: var(--black-3);
  font-size: 2rem;
  padding: 1rem;
  border-radius: 1rem;
}
</style>
