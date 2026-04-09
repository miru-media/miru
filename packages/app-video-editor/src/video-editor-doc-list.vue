<script setup lang="ts">
import { demoDoc } from './demo-document.ts'

export interface DocListItem {
  id: string
  name: string
  url: string
  createdAt: string
}

const props = defineProps<{ docs: DocListItem[] }>()

const emit = defineEmits<{
  open: [doc: DocListItem, event: Event]
  create: [title?: string, content?: any]
  delete: [id: string]
}>()
</script>

<template>
  <div class="root prose-lg dark:prose-invert">
    <div class="column">
      <div class="flex gap-1rem flex-col">
        <img
          alt="Video editing illustration"
          src="../../../website/content/media/illustrations/2.svg"
          class="<md:hidden max-w-20rem m-auto"
        />
        <button @click="() => emit('create')" class="button tertiary">
          <div class="i-tabler:plus" />
          {{ $t('create_empty_project') }}
        </button>
        <button @click="() => emit('create', 'Example', demoDoc)" class="button primary">
          <div class="i-tabler:plus" />
          {{ $t('create_example_project') }}
        </button>
      </div>
    </div>
    <div class="column">
      <h1 class="text-center mb-4">Projects</h1>
      <ul class="project-list">
        <li v-for="doc of props.docs" :key="doc.id" class="project-list-item">
          <a :href="doc.url" class="project-card" @click="(event) => emit('open', doc, event)">
            <div>{{ doc.name }}</div>
            <div class="text-[0.75em]">{{ new Date(doc.createdAt).toLocaleString() }}</div>
          </a>
          <button class="button tertiary" @click="() => emit('delete', doc.id)">
            <div class="i-tabler:trash" />
            <div class="sr-only">{{ $t('delete') }}</div>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.root {
  display: flex;
  color-scheme: dark;
  color: var(--white-3);
  padding-top: 1rem;
  justify-content: stretch;
  gap: 2rem;

  @media (width < 768px) {
    flex-direction: column;
  }
}

.column {
  flex-grow: 1;
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

.project-card {
  display: flex;
  gap: 0.675rem;
  flex-grow: 1;
  color: var(--white-3);
  border-color: gray;
  border-radius: 0.625rem;
  padding: 0.675rem 0.875rem;
  text-decoration: none;
}

.project-card {
  flex-direction: column;
  border-style: solid;
  background-color: rgb(29 107 228 / 10%);
  border-color: rgb(29 107 228 / 40%);
}

.project-delete {
  border-radius: 0.25rem;
  font-size: 1.75rem;
}
</style>
