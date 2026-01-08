import 'virtual:uno.css'
/* eslint-disable import/no-extraneous-dependencies -- -- */
import '@unocss/reset/sanitize/sanitize.css'
import '@unocss/reset/sanitize/assets.css'
/* eslint-enable import/no-extraneous-dependencies -- -- */

import { setupApp } from 'app-video-editor'
import { createApp, markRaw } from 'vue'
import * as Y from 'yjs'

import App from './app.vue'
import { IDB_DOC_NAME } from './constants.ts'
import { setupProviders } from './providers.ts'

const ydoc = markRaw(new Y.Doc())
await setupProviders(IDB_DOC_NAME, ydoc)

const app = createApp(App, { ydoc }).use(setupApp)

app.mount('#app')
