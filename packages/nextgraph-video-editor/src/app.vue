<script setup lang="ts">
import { toRef } from 'vue'
import VideoEditorDoc from './video-editor-doc.vue'
import { useAsyncState, useBrowserLocation } from '@vueuse/core'
import { getSession } from './nextgraph-session'
import { APPLICATION_CLASS_IRI } from './constants'
import { VideoEditorDocList } from 'app-video-editor'

const location = useBrowserLocation()

const docs = useAsyncState(async () => {
  const { ng, session_id } = (await getSession())!
  const ret = await ng.sparql_query(
    session_id,
    `SELECT ?storeId WHERE { GRAPH ?storeId { ?s a <${APPLICATION_CLASS_IRI}> } }`,
    undefined,
    undefined,
  )

  const docs = (ret?.results.bindings as any[])?.map((binding: any) => {
    const id: string = binding.storeId?.value
    return { id, name: id, url: `/#${id}`, createdAt: '' }
  })

  return docs
}, [])

const currentDocId = toRef(() => location.value.hash?.slice(1))

const createDoc = async (name = 'Untitled', content = undefined) => {
  const { ng, session_id } = (await getSession())!
  const nuri = await ng.doc_create(session_id, 'YMap', 'video:miru', 'store', undefined)

  console.log('new doc created', nuri)

  await ng.sparql_update(
    session_id,
    `INSERT DATA { GRAPH <${nuri}> {<${nuri}> a <${APPLICATION_CLASS_IRI}> } }`,
    nuri,
  )

  void docs.execute()
  location.value.hash = nuri
}

const deleteDoc = async (id: string) => {
  const { ng, session_id } = (await getSession())!
  throw new Error('TODO')
  docs.execute()
}

void Promise.resolve().then(async () => {
  return
  const session = (await getSession())!
  const { ng } = session
  const p = await ng.doc_fetch_private_subscribe()
  console.log(p)
})
</script>

<template>
  <div class="root">
    <Suspense v-if="currentDocId">
      <video-editor-doc :key="currentDocId" :nuri="currentDocId" />
    </Suspense>
    <VideoEditorDocList v-else :docs="docs.state.value" @create="createDoc" @delete="deleteDoc" />
  </div>
</template>

<style>
@import url('../../../docs/.vitepress/theme/bulma-config.scss');
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
