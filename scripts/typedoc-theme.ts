import { cpSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  type Application,
  DefaultTheme,
  DefaultThemeRenderContext,
  i18n,
  JSX,
  type PageEvent,
  type Reflection,
  type RenderTemplate,
} from 'typedoc'

const { createElement: h, Fragment, Raw } = JSX

const FrontMatter = ({ children: _, ...props }: Record<string, unknown>): JSX.Element =>
  h(Raw, { html: ['---', JSON.stringify(props), '---\n'].join('\n') })

class CustomThemeContext extends DefaultThemeRenderContext {
  override defaultLayout = (
    template: RenderTemplate<PageEvent<Reflection>>,
    props: PageEvent<Reflection>,
  ): JSX.Element =>
    h(Fragment, {}, [
      h(FrontMatter, {
        title: props.model.name,
        typedocBase: this.relativeURL('./'),
        layout: 'layouts/page',
        pageContainerClass: 'typedoc-page-container',
        pageClass: 'm-5%',
        mainId: 'typedoc-main',
      }),

      this.#head(),

      h('div', { class: 'typedoc-main-container' }, [
        this.#siteSidebar(template, props),
        this.#content(template, props),
      ]),
    ])

  #head(): JSX.Element {
    return h(Fragment, {}, [
      this.hook('head.begin', this),

      ...['style', 'highlight'].map((name) =>
        h('link', { rel: 'stylesheet', href: `/api/assets/${name}.css` }),
      ),
      h(Raw, {
        html: `<style>
  @layer typedoc {
    :root {
      /* override LaunchKit theme variables */
      --space-section: 0 !important;
      --font-size-s: 0.875rem !important;
      --font-size-m: 1rem !important;
      --font-size-l: 1.25rem !important;
      --font-size-xl: 1.5rem !important;
      --font-size-xxl: 2rem !important;
    }
    dt, dd { margin-top: 0 !important; }
    .tsd-member h3 { font-family: Menlo, Monaco, Consolas, "Courier New", monospace; }
    .tsd-breadcrumb { padding: 0 !important; }
    .tsd-theme-toggle, .tsd-toolbar-contents .title { display: none; }
    .typedoc-page-container {
      display: flex;
      flex-direction: column;
      max-width: 1800px;
      min-height: 100vh;
      margin: 0 auto;
    }
    .typedoc-main-container {
      display: flex;
      gap: 1rem;
    }
    .typedoc-sidebar {
      width: 20rem;
      flex-shrink: 0;
      padding-top: 1rem;
    }
    #tsd-search-trigger {
      display: flex !important;
      width: 100%;
      padding: 0.5rem 1rem !important;
      justify-content: space-between !important;
    }
    .tsd-navigation > a:first-child { display: none; }
  }
  </style>`,
      }),
      ...[
        { defer: true, name: 'main' },
        { async: true, name: 'icons', id: 'tsd-icons-script' },
        { async: true, name: 'search', id: 'tsd-search-script' },
        { async: true, name: 'navigation', id: 'tsd-nav-script' },
      ].map(({ async, defer, name, id }) => h('script', { defer, async, id, src: `/api/assets/${name}.js` })),
      // !!getHierarchyRoots(props.project).length &&
      //   h('script', {
      //     async: true,
      //     src: this.relativeURL('assets/hierarchy.js', true),
      //     id: 'tsd-hierarchy-script',
      //   }),
      this.hook('head.end', this),
    ])
  }

  #siteSidebar(_template: RenderTemplate<PageEvent<Reflection>>, props: PageEvent<Reflection>): JSX.Element {
    return h('div', { class: 'typedoc-sidebar' }, [this.#search(), this.sidebar(props)])
  }

  #search(): JSX.Element {
    return h('div', {}, [
      h('button', { id: 'tsd-search-trigger', class: 'button tertiary' }, [
        i18n.theme_search(),
        this.icons.search(),
      ]),
      h('dialog', { id: 'tsd-search', 'aria-label': i18n.theme_search() }, [
        h('input', {
          role: 'combobox',
          id: 'tsd-search-input',
          'aria-controls': 'tsd-search-results',
          'aria-autocomplete': 'list',
          'aria-expanded': 'true',
          spellcheck: false,
          autocapitalize: 'off',
          autocomplete: 'off',
          placeholder: i18n.theme_search_placeholder(),
          maxLength: 100,
        }),
        h('ul', { role: 'listbox', id: 'tsd-search-results' }),
        h(
          'div',
          { id: 'tsd-search-status', 'aria-live': 'polite', 'aria-atomic': 'true' },
          h('div', { children: i18n.theme_preparing_search_index() }),
        ),
      ]),
    ])
  }

  #content(template: RenderTemplate<PageEvent<Reflection>>, props: PageEvent<Reflection>): JSX.Element {
    return h('div', { class: 'prose-sm dark:prose-invert' }, [
      this.header(props),
      this.hook('content.begin', this),
      template(props),
      this.hook('content.end', this),
    ])
  }
}

class CustomTheme extends DefaultTheme {
  static _name = 'custom-theme'

  getRenderContext(pageEvent: PageEvent<Reflection>): CustomThemeContext {
    return new CustomThemeContext(this.router, this, pageEvent, this.application.options)
  }

  render(page: PageEvent): string {
    return super.render(page).replace('<!DOCTYPE html>', '')
  }
}

export const load = (app: Application) => {
  app.renderer.defineTheme(CustomTheme._name, CustomTheme)
  app.on('bootstrapEnd', () => {
    app.setOptions({ theme: CustomTheme._name, router: 'kind-dir' })
  })

  app.on('generateOutputsEnd', () => {
    const publicAssetsDir = resolve(import.meta.dirname, '..', 'website/public/api/assets')
    rmSync(publicAssetsDir, { recursive: true })
    cpSync(resolve(app.options.getValue('out'), 'assets'), publicAssetsDir, { recursive: true })
  })
}
