<script setup lang="ts">
import { computed, toRef } from 'vue'
import * as Y from 'yjs'

import VideoEditorDoc from './video-editor-doc.vue'
import { useBrowserLocation } from '@vueuse/core'
import { getSession } from './nextgraph-session'
import { useI18n, VideoEditorDocList } from 'app-video-editor'
import { useShape } from '@ng-org/orm/vue'
import { MiruVideoShapeType } from './shapes/orm/video.shapeTypes'
import type { MiruVideo } from './shapes/orm/video.typings'
import { INITIAL_DOC_UPDATE, OBJECT_ID_LENGTH } from './constants'
import { digestToString } from './nextgraph-provider'
import { initYmapFromJson } from 'webgl-video-editor/store/utils.js'
import type { Schema } from 'webgl-video-editor'

const location = useBrowserLocation()
const { t } = useI18n()

const docs = useShape<MiruVideo>(MiruVideoShapeType, '')

const docList = computed(() =>
  [...docs]
    .map((entry) => {
      console.log(entry)
      const id: string = entry['@id']

      return { id, name: entry.title, url: getDocUrl(id), createdAt: entry.createdAt }
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
)

const currentDoc = toRef(() => {
  const docId = location.value.hash?.slice(1)
  if (docId) return [...docs].find((d) => d['@id'] === docId)
})

const getDocUrl = (id: string) => `${import.meta.env.BASE_URL}#${id}`

const createDoc = async (title = 'Untitled', content: Schema.SerializedDocument | undefined = undefined) => {
  const { ng, session_id: sessionId, private_store_id: privateStoreId } = (await getSession())!
  const nuri = await ng.doc_create(
    sessionId,
    'YMap',
    import.meta.env.DEV ? 'data:map' : 'video:miru',
    'store',
    undefined,
  )
  const objectId = nuri.slice(0, OBJECT_ID_LENGTH)

  if (content) {
    const heads: string[] = []

    await new Promise<void>((resolve, reject) =>
      ng
        .doc_subscribe(
          objectId,
          sessionId,
          (response: {
            V0: {
              TabInfo?: Record<string, unknown>
              State?: Record<string, any>
              Patch?: Record<string, any>
            }
          }) => {
            if (response.V0.State) {
              for (const head of response.V0.State.heads) {
                const commitId = digestToString(head)
                heads.push(commitId)
              }
              resolve()
            }
          },
        )
        .catch(reject),
    )

    const ydoc = new Y.Doc()
    Y.applyUpdate(ydoc, INITIAL_DOC_UPDATE)
    initYmapFromJson({ root: ydoc.getMap('ng'), content })

    await ng.discrete_update(sessionId, Y.encodeStateAsUpdate(ydoc), heads, 'YMap', nuri)
  }

  docs.add({
    '@graph': nuri || `did:ng:${privateStoreId}`,
    '@id': objectId,
    '@type': 'did:ng:z:MiruVideo',
    title: title,
    createdAt: new Date().toISOString(),
  })

  location.value.hash = getDocUrl(nuri)
}

const deleteDoc = async (docId: string) => {
  if (!window.confirm(t('confirm_delete_project'))) return

  const entry = [...docs].find((d) => d['@id'] === docId)
  if (entry) docs.delete(entry)
}
</script>

<template>
  <div class="root">
    <Suspense v-if="docs && currentDoc">
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
