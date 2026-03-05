<script setup lang="ts">
import { VideoEditorApp } from 'app-video-editor'
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

const store = markRaw(new VideoEditorYjsStore(ngMap!))
const editor = ref<NextGraphVideoEditor>()

watch(
  () => docSet.first(),
  (doc, _prev, onCleanup) => {
    if (!doc) {
      editor.value = undefined
      return
    }
    
    console.log(doc.__raw__)

    const editor_ = (editor.value = markRaw(new NextGraphVideoEditor({ store, session, graphObject: doc })))
    onCleanup(() => editor_.dispose())
  },
  { immediate: true },
)

const onCloseProject = () => (location.hash = '')

console.log(location.origin + import.meta.env.BASE_URL + '#' + graphObject['@id'])
</script>

<template>
  <video-editor-app v-if="editor" :store :onCloseProject :editor />
</template>
