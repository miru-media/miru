import 'virtual:uno.css'
import './custom.css'

import { setupApp } from 'app-video-editor'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'

import Layout from './Layout.vue'

const theme: Theme = {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.use(setupApp)
  },
}
export default theme
