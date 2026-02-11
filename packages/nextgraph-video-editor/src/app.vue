<script setup lang="ts">
import { toRef } from 'vue'
import VideoEditorDoc from './video-editor-doc.vue'
import { useBrowserLocation } from '@vueuse/core'
import { getSession } from './nextgraph-session'

const location = useBrowserLocation()

const currentDoc = toRef(() => location.value.hash?.slice(1))

const createDoc = async () => {
  const { ng, session_id } = await getSession()
  const nuri = await ng.doc_create(session_id, 'YMap', 'video:miru', 'store')

  console.log('new doc created', nuri)
  location.value.hash = nuri
}
</script>

<template>
  <div class="root">
    <Suspense v-if="currentDoc">
      <video-editor-doc :key="currentDoc" :nuri="currentDoc" />
    </Suspense>
    <div v-else class="projects">
      <!--
      <ul>
        <li v-for="doc of documents">
          <a :href="'#' + doc.guid" class="project-item">Open doc {{ doc.guid }}</a>
        </li>
      </ul>
      -->
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
