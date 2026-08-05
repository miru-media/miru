<script setup lang="ts">
import { useAsyncState, useTimeAgoIntl } from '@vueuse/core'
import type { DocListItem } from './video-editor-doc-list.vue'
import type { Schema } from 'webgl-video-editor'
import { ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n-lite'

const props = defineProps<{ doc: DocListItem }>()
const i18n = useI18n()

const emit = defineEmits<{
  open: [doc: DocListItem, event: Event]
  create: [title?: string, content?: Schema.SerializedDocument]
  delete: [id: string]
}>()

const thumbnail = useAsyncState(() => Promise.resolve(props.doc.thumbnail), undefined)
const thumbnailUrl = ref<string>()

watch(thumbnail.state, (thumbnail, _prev, onCleanup) => {
  thumbnailUrl.value = undefined
  if (!thumbnail) return

  if (typeof thumbnail === 'string') thumbnailUrl.value = thumbnail
  else {
    const url = (thumbnailUrl.value = URL.createObjectURL(thumbnail))
    onCleanup(() => URL.revokeObjectURL(url))
  }
})

const updatedAtRelative = useTimeAgoIntl(() => props.doc.updatedAt || props.doc.createdAt, {
  locale: i18n.current.value,
})

const onOpen = (event: Event) => emit('open', props.doc, event)
const _id = useId()
</script>

<template>
  <li
    :key="doc.id"
    class="card"
    :aria-labelledby="`name_${_id}`"
    tabindex="0"
    @keydown.enter="onOpen"
    @dblclick="onOpen"
  >
    <img v-if="thumbnailUrl" :src="thumbnailUrl" class="card-media" alt="" />
    <div v-else class="card-media">
      <div class="i-material-symbols:video-file-outline text-5rem opacity-30"></div>
    </div>
    <div class="card-content">
      <div class="card-info">
        <div :id="`name_${_id}`">{{ doc.name }}</div>
        <div class="text-0.75em text-#aaacc2">{{ $t('edited_since') }} {{ updatedAtRelative }}</div>
      </div>
      <div class="card-actions">
        <button class="button tertiary" @click="() => emit('delete', doc.id)">
          <div class="i-material-symbols:delete-outline-rounded" />
          <div class="sr-only">{{ $t('delete') }}</div>
        </button>
        <a :href="doc.url" class="button primary" @click="onOpen">
          <span>{{ $t('open') }}</span>
        </a>
      </div>
    </div>
  </li>
</template>

<style scoped>
.card {
  display: grid;
  gap: 1rem;
  color: inherit;
  border-color: gray;
  border-radius: 0.625rem;
  padding: 0.5rem;
  text-decoration: none;
  font-size: 0.87rem;
}

.card-media {
  aspect-ratio: 448 / 252;
  object-fit: cover;
  width: 100%;
  border-radius: 0.625rem;
  background-color: #2c3033;
  display: flex;
  place-items: center;
  place-content: center;
}

.card-content {
  display: grid;
  grid-template:
    'a b' auto
    / 1fr auto;
  gap: 1rem;
  align-items: start;
  min-width: 0;
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  & > * {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    text-wrap: nowrap;
    line-height: 1.5;
  }
}

.card-actions {
  display: flex;
  gap: 0.25rem;
}

.button {
  font-size: inherit;
}
</style>
