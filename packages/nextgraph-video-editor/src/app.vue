<script setup lang="ts">
import { computed, toRef } from 'vue'
import VideoEditorDoc from './video-editor-doc.vue'
import { useAsyncState, useBrowserLocation } from '@vueuse/core'
import { getSession } from './nextgraph-session'
// import { APPLICATION_CLASS_IRI } from './constants'
import { VideoEditorDocList } from 'app-video-editor'
import { useShape } from '@ng-org/orm/vue'
import { MiruVideoShapeType } from './shapes/orm/video.shapeTypes'
import type { MiruVideo } from './shapes/orm/video.typings'

const location = useBrowserLocation()

const asyncDocs = useAsyncState(async () => {
  const { private_store_id } = (await getSession())!
  const docs = useShape<MiruVideo>(MiruVideoShapeType, `did:ng:${private_store_id}`)

  return docs
}, new Set() as never)

const docList = computed(() =>
  [...asyncDocs.state.value]
    .map((entry) => {
      console.log(entry)
      const id: string = entry['@id']

      return { id, name: entry.title, url: `${import.meta.env.BASE_URL}#${id}`, createdAt: entry.createdAt }
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
)

const currentDoc = toRef(() => {
  const docId = location.value.hash?.slice(1)
  if (docId) return [...asyncDocs.state.value].find((d) => d['@id'] === docId)
})

const createDoc = async (title = 'Untitled', content = undefined) => {
  const { ng, session_id } = (await getSession())!
  const nuri = await ng.doc_create(session_id, 'YMap', 'video:miru', 'store', undefined)
  const docsSet = asyncDocs.state.value

  docsSet.add({
    '@graph': nuri,
    '@type': 'did:ng:z:MiruVideo',
    '@id': nuri,
    title: title,
    createdAt: new Date().toISOString(),
  })

  // location.value.hash = nuri
}

const deleteDoc = async (id: string) => {
  const docSet = (await asyncDocs).state.value
  const entry = docSet.getById(id)
  if (entry) docSet.delete(entry)
}

/*
const createDoc_ = async (name = 'Untitled', content = undefined) => {
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

const docs = useAsyncState(async () => {
  const { ng, session_id } = (await getSession())!
  const ret = await ng.sparql_query(
    session_id,
    `SELECT ?storeId ?createdAt ?title WHERE { GRAPH ?storeId { ?s a <${APPLICATION_CLASS_IRI}> } }`,
    undefined,
    undefined,
  )

  const docs = (ret?.results.bindings as any[])?.map((binding: any) => {
    const id: string = binding.storeId?.value
    return { id, name: id, url: `/#${id}`, createdAt: '' }
  })

  return docs
}, [])
*/
</script>

<template>
  <div class="root">
    <Suspense v-if="asyncDocs.isReady.value && currentDoc">
      <video-editor-doc :key="currentDoc?.['@id']" :graphObject="currentDoc" />
    </Suspense>
    <VideoEditorDocList v-else :docs="docList" @create="createDoc" @delete="deleteDoc" />
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
