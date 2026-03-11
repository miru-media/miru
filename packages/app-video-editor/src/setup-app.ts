import type { App } from 'vue'
import { createI18n, useI18n } from 'vue-i18n-lite'

import { win } from 'shared/utils'
import de_ from 'webgl-video-editor/locales/de.json'
import en_ from 'webgl-video-editor/locales/en.json'

export const setupApp = {
  install(app: App): void {
    const en = {
      ...en_,
      error_loading_doc: `There was an error loading this project`,
      error_loading_doc_info: `It may be corrupted or from an older unsupported version. Please try again with a new project.`,
      error_back_to_doc_list: `Back to project list`,
      load_demo_video: 'Load demo video',
    }
    const de = {
      ...de_,
      error_loading_doc: `Der Inhalt des Projekts konnte nicht wiederhergestellt werden.`,
      error_loading_doc_info: ``,
      error_back_to_doc_list: `Zurück zur Projektliste`,
      load_demo_video: 'Beispielfilm laden',
    }

    app.use(
      createI18n({
        locale: (win as Partial<typeof win>).navigator?.language.replace(/-.*/u, ''),
        fallbackLocale: 'en',
        messages: {
          en,
          de,
        } satisfies Record<string, typeof en>,
      }),
    )
  },
}

export { useI18n }
