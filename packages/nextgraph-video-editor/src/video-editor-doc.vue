<script setup lang="ts">
import { VideoEditorDoc, VideoEditorDocError } from 'app-video-editor'
import { markRaw, ref, toRef, watch } from 'vue'
import * as Y from 'yjs'

import { YjsSync } from 'webgl-video-editor/yjs'
import { setupProviders } from './providers'
import { INITIAL_DOC_UPDATE } from './constants'
import { NextGraphVideoEditor } from './nextgraph-video-editor'
import type { MiruVideoDocument } from './shapes/orm/video.typings'
import { useShape } from '@ng-org/orm/vue'
import { MiruVideoDocumentShapeType } from './shapes/orm/video.shapeTypes'
import { nuriToObjectId } from './utils'
import { getSession } from './nextgraph-session'
import { NextGraphAssetStore } from './nextgraph-asset-store'

const { nuri } = defineProps<{ nuri: string }>()
const ydoc = new Y.Doc()

Y.applyUpdateV2(ydoc, INITIAL_DOC_UPDATE)
const ngMap = ydoc.getMap<Y.Map<any>>('ng')
const docSet = useShape<MiruVideoDocument>(MiruVideoDocumentShapeType, {
  graphs: [],
  subjects: [nuriToObjectId(nuri)],
})

const [session] = await Promise.all([getSession(), setupProviders(nuriToObjectId(nuri), ydoc)])

const editor = ref<NextGraphVideoEditor>()
const error = ref<unknown>()
const doc = toRef(() => docSet.first())

watch(
  doc,
  (doc, _prev, onCleanup) => {
    if (!doc) {
      editor.value = undefined
      return
    }

    let sync: YjsSync | undefined

    try {
      sync = markRaw(new YjsSync(ngMap!, new NextGraphAssetStore({ session: session!, graphObject: doc })))
      editor.value = markRaw(new NextGraphVideoEditor({ sync, session: session! }))
    } catch (error_: unknown) {
      console.error(error_)
      error.value = error_
    }

    onCleanup(() => {
      error.value = undefined
      editor.value?.dispose()
      sync?.dispose()
    })
  },
  { immediate: true },
)

const onCloseProject = () => (location.hash = '')

const backUrl = import.meta.env.BASE_URL
</script>

<template>
  <VideoEditorDocError v-if="error" :backUrl />
  <VideoEditorDoc v-else-if="editor && doc" :onCloseProject :editor v-model:name="doc.name" />
</template>
