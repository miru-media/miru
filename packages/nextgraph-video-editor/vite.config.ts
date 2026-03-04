/* eslint-disable import/no-extraneous-dependencies, import/no-relative-packages -- dev tooling */
import vue from '@vitejs/plugin-vue'
import markdown from 'unplugin-vue-markdown/vite'
import { defineConfig, mergeConfig } from 'vite'

import config from '../../vite.config.ts'

export default mergeConfig(
  config,
  defineConfig({
    root: import.meta.dirname,
    base: '/nextgraph',
    plugins: [vue({ include: [/\.vue$/, /\.md$/] }), markdown({})],
  }),
)
