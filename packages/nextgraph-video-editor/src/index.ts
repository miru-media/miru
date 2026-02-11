import 'virtual:uno.css'
/* eslint-disable import/no-extraneous-dependencies -- -- */
import '@unocss/reset/sanitize/sanitize.css'
import '@unocss/reset/sanitize/assets.css'
/* eslint-enable import/no-extraneous-dependencies -- -- */

import { setupApp } from 'app-video-editor'
import { createApp } from 'vue'

import App from './app.vue'

const app = createApp(App).use(setupApp)

app.mount('#app')
