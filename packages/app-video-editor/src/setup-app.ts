import type { App } from 'vue'
import { createI18n, useI18n } from 'vue-i18n-lite'

import { win } from 'shared/utils'
import de from 'webgl-video-editor/locales/de.json'
import en from 'webgl-video-editor/locales/en.json'

export const setupApp = {
  install(app: App): void {
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

export { useI18n }
