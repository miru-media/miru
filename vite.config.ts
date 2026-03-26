import { extendViteConfig } from './config/base-vite-config.ts'

export default extendViteConfig({
  test: {
    environment: 'happy-dom',
    coverage: {
      enabled: true,
      exclude: ['packages/shared/assets/**', '**/*.{css,svg,d.ts,glsl,frag,vert}'],
    },
  },
})
