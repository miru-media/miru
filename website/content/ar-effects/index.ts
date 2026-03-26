import { setupApp } from 'app-video-editor'
import { createApp } from 'vue'

import App from './ar-effects.vue'

const app = createApp(App).use(setupApp)

app.mount('#app')
