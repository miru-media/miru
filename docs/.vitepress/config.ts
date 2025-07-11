import { resolve } from 'node:path'

import taskLists from 'markdown-it-task-lists'
import { defineConfig } from 'vitepress'

import vite from '../../vite.config'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Miru',
  description: 'Multi-track video editing and real-time AR effects',
  head: [
    ['link', { rel: 'icon', href: '/favicon.svg', type: 'image/svg' }],
    ['link', { rel: 'icon', href: '/favicon.ico', type: 'image/x-icon' }],
    ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:image', content: '/og.png' }],
  ],
  vite,
  cleanUrls: true,
  srcExclude: [resolve(__dirname, '_vitePress')],
  vue: {
    template: {
      compilerOptions: {
        isCustomElement: (tag) =>
          tag === 'media-trimmer' || tag.startsWith('media-editor') || tag.startsWith('webgl-effects-'),
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
    siteTitle: false,
    nav: [
      {
        text: 'Demos',
        items: [
          { text: 'Video editor', link: '/video-editor' },
          { text: 'Video trimmer', link: '/video-trimmer' },
          { text: 'Photo editor', link: '/photo-editor' },
        ],
      },
      { text: 'Guide', link: '/guide/introduction' },
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'What is Miru?', link: '/guide/introduction' },
          {
            text: 'Packages',
            items: [
              { text: 'webgl-media-editor', link: '/guide/webgl-media-editor' },
              { text: 'webgl-video-editor', link: '/guide/webgl-video-editor' },
              { text: 'media-trimmer', link: '/guide/media-trimmer' },
            ],
          },
        ],
      },
      {
        text: 'About',
        items: [
          { text: 'Roadmap', link: 'roadmap' },
          { text: 'Code of conduct', link: 'code-of-conduct' },
        ],
      },
      {
        text: 'Demos',
        link: '/demos',
        items: [
          { text: 'Photo editor', link: '/photo-editor' },
          { text: 'Video editor', link: '/video-editor' },
          { text: 'Video trimmer', link: '/video-trimmer' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/miru-media/miru', ariaLabel: 'Source code on Github' },
      {
        icon: 'codeberg',
        link: 'https://codeberg.org/miru-media/miru',
        ariaLabel: 'Source code on Codeberg',
      },
    ],

    externalLinkIcon: true,
  },
  markdown: {
    config(md) {
      md.use(taskLists)
    },
  },
})
