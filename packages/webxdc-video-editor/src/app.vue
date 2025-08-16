<script setup lang="ts">
import { customRef, markRaw, onScopeDispose, toRef } from 'vue'
import * as Y from 'yjs'
import VideoEditorDoc from './video-editor-doc.vue'
import { useLocalStorage } from '@vueuse/core'

const { ydoc } = defineProps<{ ydoc: Y.Doc }>()

const currentDocIndex = useLocalStorage('currentDocIndex', -1)

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
const currentDoc = toRef((): Y.Doc | undefined => documents.value.get(currentDocIndex.value))

const createDoc = () => {
  const docs = documents.value
  docs.push([new Y.Doc()])
  currentDocIndex.value = docs.length - 1
}
</script>

<template>
  <div class="root">
    <Suspense v-if="currentDoc">
      <video-editor-doc :key="currentDoc.guid" :ydoc="currentDoc" />
    </Suspense>
    <div v-else class="create-container">
      <button @click="createDoc" class="create">
        <span class="i-tabler:plus" />
        {{ $t('create_doc') }}
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

.create-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.create {
  display: flex;
  align-items: center;
  cursor: pointer;
  background-color: var(--black-3);
  font-size: 3rem;
  padding: 1rem;
  border-radius: 1rem;
}
</style>
