// eslint-disable-next-line import/no-unresolved
import 'virtual:uno.css'
import './custom.css'

import { type Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { createI18n } from 'vue-i18n-lite'

import { win } from 'shared/utils'
import de from 'webgl-video-editor/locales/de.json'
import en from 'webgl-video-editor/locales/en.json'

import Layout from './Layout.vue'

const theme: Theme = {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.use(
      createI18n({
        locale: (win as Partial<typeof win>).navigator?.language.replace(/-.*/, ''),
        fallbackLocale: 'en',
        messages: {
          en: {
            ...en,
            restore_failed: `Couldn't restore video editor content.`,
            load_demo_video: 'Load demo video',
          },
          de: {
            ...de,
            restore_failed: `Der Inhalt des Videoeditors konnte nicht wiederhergestellt werden.`,
            load_demo_video: 'Beispielfilm laden',
          },
        },
      }),
    )
  },
}
export default theme
