import { resolve } from 'node:path'

import { defineConfig } from 'vitepress'

// eslint-disable-next-line import/no-relative-packages
import vite from '../../vite.config'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Miru',
  description: 'Multi-track video editing and real-time AR effects',
  vite,
  cleanUrls: true,
  srcExclude: [resolve(__dirname, '_vitePress')],
  vue: {
    template: {
      compilerOptions: {
        isCustomElement: (tag) => tag === 'media-trimmer' || tag.startsWith('media-editor'),
      },
    },
  },
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: {
      light: '/dark-logo.svg',
      dark: '/white-logo.svg',
      alt: 'Miru logo',
    },
    siteTitle: '',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Video editor', link: '/video-editor' },
      { text: 'Video trimmer', link: '/video-trimmer' },
      { text: 'Photo editor', link: '/photo-editor' },
    ],

    sidebar: [],

    socialLinks: [{ icon: 'gitea', link: 'https://gitea.com/miru/miru', ariaLabel: 'Source code' }],
  },
})
