import { setupApp } from 'app-video-editor'
import { createApp } from 'vue'

import App from './video-trimmer.vue'

const app = createApp(App).use(setupApp)

app.mount('#app')
