<script setup lang="ts">
import type { Schema } from 'webgl-video-editor'
import { useI18n } from 'vue-i18n-lite'

import { demoDoc } from './demo-document.ts'
import Header from './video-editor-header.vue'
import DocCard from './video-editor-doc-list-card.vue'

export interface DocListItem {
  id: string
  name: string
  url: string
  thumbnail?: Promise<Blob | string | undefined> | Blob | string
  createdAt: string
  updatedAt: string
}

const props = defineProps<{ docs: DocListItem[] }>()

const emit = defineEmits<{
  open: [doc: DocListItem, event: Event]
  create: [title?: string, content?: Schema.SerializedDocument]
  delete: [id: string]
}>()

const { t } = useI18n()

const onInputOtio = async (event: InputEvent) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  const { documentJSONFromOTIO, documentJSONFromOTIOZ } = await import('webgl-video-editor/otio')

  const doc: Schema.SerializedDocument =
    file.type.includes('zip') || file.name.endsWith('.otioz')
      ? await documentJSONFromOTIOZ(file)
      : await documentJSONFromOTIO(JSON.parse(await file.text()))

  console.log(doc)

  const title =
    (doc.metadata?.name as string | undefined) || file?.name.replace(/\.(otioz?)$/u, '') || t('untitled')
  emit('create', title, doc)
}
</script>

<template>
  <div class="doc-list-root">
    <Header class="doc-list-header">
      <template #start><slot name="header-start"></slot></template>
      <template #middle><slot name="header-middle"></slot></template>
      <template #end><slot name="header-end"></slot></template>
    </Header>

    <div class="doc-list-main">
      <h1 class="text-2xl">{{ $t('my_projects') }}</h1>

      <p class="create-buttons">
        <button @click="() => emit('create')" class="button tertiary create-button">
          {{ $t('create_empty_project') }}
          <div class="i-material-symbols:add-circle-outline-rounded text-2xl" />
        </button>
        <label class="button tertiary create-button">
          {{ $t('import_project') }} (<code>.otio</code>)
          <div class="i-material-symbols:upload-rounded text-2xl" />
          <input type="file" accept=".otio,.otioz,.json" class="sr-only" @input="onInputOtio" />
        </label>
        <button @click="() => emit('create', 'Example', demoDoc)" class="button primary create-button">
          {{ $t('create_example_project') }}
          <div class="i-material-symbols:rocket-launch-outline-rounded text-2xl" />
        </button>
      </p>

      <ul class="card-grid">
        <DocCard
          :doc="doc"
          v-for="doc of props.docs"
          :key="doc.id"
          @open="(...args) => emit('open', ...args)"
          @delete="(...args) => emit('delete', ...args)"
        />
      </ul>
    </div>
  </div>
</template>

<style scoped>
.doc-list-root {
  display: flex;
  height: 100%;
  flex-direction: column;
}

.doc-list-header {
  border-bottom: solid 1px #2c3033;
  flex-shrink: 0;
}

.create-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 2rem;
}

.create-button {
  display: inline-flex;
  flex-shrink: 0;
}

.doc-list-main {
  color-scheme: dark;
  color: var(--white-3);
  justify-content: stretch;
  gap: 2rem;
  width: 100%;
  min-height: 0;
  padding: 1rem 1.875rem 0;
  overflow: auto;
}

.card-grid {
  padding: 0 0 4rem;
  margin: 0;
  display: grid;
  list-style: none;
  grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr));
  align-items: stretch;
  gap: 0.75rem;
}
</style>
