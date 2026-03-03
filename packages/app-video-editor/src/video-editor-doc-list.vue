<script setup lang="ts">
import { demoDoc } from './demo-document.ts'

interface DocListItem {
  id: string
  name: string
  url: string
  createdAt: string
}

const props = defineProps<{ docs: DocListItem[] }>()

const emit = defineEmits<{ create: [title?: string, content?: any]; delete: [id: string] }>()
</script>

<template>
  <div class="root bulma-container">
    <div class="bulma-columns columns-container">
      <div class="bulma-column">
        <div class="bulma-content">
          <h1 class="text-center mb-4">Projects</h1>
        </div>
        <ClientOnly>
          <ul class="project-list">
            <li v-for="{ id, name, url, createdAt } of props.docs" :key="id" class="project-list-item">
              <a :href="url" class="project-card">
                <div>{{ name }}</div>
                <div class="text-[0.75em]">{{ new Date(createdAt).toLocaleString() }}</div>
              </a>
              <button class="project-delete" @click="() => emit('delete', id)">
                <div class="i-tabler:trash" />
                <div class="sr-only">{{ $t('delete') }}</div>
              </button>
            </li>
          </ul>
        </ClientOnly>
      </div>
      <div class="bulma-column">
        <div class="flex gap-1rem flex-col">
          <img
            alt="Video editing illustration"
            src="../../../docs/branding/illustrations/2.svg"
            class="bulma-is-hidden-mobile max-w-20rem m-auto"
          />
          <button @click="() => emit('create')" class="create-button">
            <div class="i-tabler:plus" />
            {{ $t('create_empty_project') }}
          </button>
          <button @click="() => emit('create', 'Example', demoDoc)" class="create-button">
            <div class="i-tabler:plus" />
            {{ $t('create_example_project') }}
          </button>
        </div>
      </div>
    </div>
  </div>
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
