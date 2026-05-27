import 'virtual:uno.css'

import { setupApp } from 'app-video-editor'
import { createApp } from 'vue'

import App from './app.vue'

const app = createApp(App).use(setupApp)

app.mount('#app')
