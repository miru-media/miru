<script setup lang="ts">
import { VideoEditorDoc, VideoEditorDocError } from 'app-video-editor'
import { markRaw, ref, watch } from 'vue'
import * as Y from 'yjs'

import { VideoEditorYjsStore } from 'webgl-video-editor/store/yjs.js'
import { setupProviders } from './providers'
import { INITIAL_DOC_UPDATE } from './constants'
import { NextGraphVideoEditor } from './nextgraph-video-editor'
import type { MiruVideoDocument } from './shapes/orm/video.typings'
import type { Session } from '@ng-org/web'
import { useShape } from '@ng-org/orm/vue'
import { MiruVideoDocumentShapeType } from './shapes/orm/video.shapeTypes'

const { graphObject, session } = defineProps<{ graphObject: MiruVideoDocument; session: Session }>()
const ydoc = new Y.Doc()

Y.applyUpdateV2(ydoc, INITIAL_DOC_UPDATE)
const ngMap = ydoc.getMap<Y.Map<any>>('ng')
const docSet = useShape<MiruVideoDocument>(MiruVideoDocumentShapeType, '')

await setupProviders(graphObject['@id'], ydoc)

const editor = ref<NextGraphVideoEditor>()
const error = ref<unknown>()

watch(
  () => docSet.first(),
  (doc, _prev, onCleanup) => {
    if (!doc) {
      editor.value = undefined
      return
    }

    console.log(doc.__raw__)

    let store: VideoEditorYjsStore | undefined

    try {
      store = markRaw(new VideoEditorYjsStore(ngMap!))
      editor.value = markRaw(new NextGraphVideoEditor({ store, session, graphObject: doc }))
    } catch (error_: unknown) {
      error.value = error_
    }

    onCleanup(() => {
      error.value = undefined
      editor.value?.dispose()
      store?.dispose()
    })
  },
  { immediate: true },
)

const onCloseProject = () => (location.hash = '')

const backUrl = import.meta.env.BASE_URL
</script>

<template>
  <VideoEditorDocError v-if="error" :backUrl />
  <VideoEditorDoc v-else-if="editor" :onCloseProject :editor v-model:name="graphObject.name" />
</template>
