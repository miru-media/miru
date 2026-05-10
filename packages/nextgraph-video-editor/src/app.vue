<script setup lang="ts">
import { computed, toRef } from 'vue'

import VideoEditorDoc from './video-editor-doc.vue'
import { useBrowserLocation } from '@vueuse/core'
import { getSession } from './nextgraph-session'
import { useI18n, VideoEditorDocList } from 'app-video-editor'
import { useShape } from '@ng-org/orm/vue'
import { MiruVideoDocumentSummaryShapeType } from './shapes/orm/video.shapeTypes'
import type { MiruVideoDocumentSummary } from './shapes/orm/video.typings'
import type { Schema } from 'webgl-video-editor'
import { createNextGraphDoc, nuriToObjectId } from './utils'

const location = useBrowserLocation()
const { t } = useI18n()

const docs = useShape<MiruVideoDocumentSummary>(MiruVideoDocumentSummaryShapeType, '')

const docList = computed(() =>
  [...docs]
    .map((entry) => {
      console.log(entry)
      const id: string = entry['@id']

      return { id, name: entry.name, url: getDocUrl(id), createdAt: entry.createdAt }
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
)

const currentDoc = toRef(() => {
  const docId = location.value.hash?.slice(1)
  if (docId) {
    console.log(getDocUrl(docId))
    return [...docs].find((d) => d['@id'] === docId)
  }
})

const getDocUrl = (id: string) => `${import.meta.env.BASE_URL}#${nuriToObjectId(id)}`

const createDoc = async (name = 'Untitled', content: Schema.SerializedDocument | undefined = undefined) => {
  const nuri = await createNextGraphDoc({ name, content, session: (await getSession())! })
  location.value.href = getDocUrl(nuri)
}

const deleteDoc = async (docId: string) => {
  if (!window.confirm(t('confirm_delete_project'))) return

  const entry = [...docs].find((d) => d['@id'] === docId)
  if (entry) docs.delete(entry)
}
</script>

<template>
  <div class="root">
    <Suspense v-if="currentDoc">
      <video-editor-doc :key="currentDoc['@id']" :nuri="currentDoc['@id']" />
    </Suspense>
    <VideoEditorDocList v-else :docs="docList" @create="createDoc" @delete="deleteDoc" />
  </div>
</template>

<style>
@import url('../../../website/css/index.css');

:root {
  --white-3: rgb(255 255 255 / 60%);
}
</style>

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
