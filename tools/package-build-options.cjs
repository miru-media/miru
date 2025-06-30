/* eslint-disable @typescript-eslint/no-require-imports */
// eslint-disable-next-line @typescript-eslint/unbound-method
const { resolve } = require('path')

/**
 * @typedef {{
 *   root: string,
 *   inputs: Record<string, string>
 *   external?: import('rollup').RollupOptions['external']
 *   alwaysBundle?: string[]
 *   dist?: string
 *   clearDist?: boolean
 *   copy?: (opitons: Required<Omit<Options, 'copy'>>) => import('rollup-plugin-copy').CopyOptions
 * }} Options
 **/

/** @type {Options[]} */
const packageOptions = [
  {
    root: 'packages/webgl-effects',
    inputs: {
      'webgl-effects': 'src/index.ts',
    },
    copy: (options) => ({
      targets: [{ src: resolve(options.root, 'src/types/*'), dest: options.dist }],
    }),
    alwaysBundle: ['@libav.js/variant-opus'],
  },
  {
    root: 'packages/webgl-media-editor',
    inputs: {
      'webgl-media-editor': 'src/index.ts',
      vue2: 'src/vue2/index.ts',
    },
  },
  {
    root: 'packages/media-trimmer',
    inputs: {
      'media-trimmer': 'src/index.ts',
      elements: 'src/elements/index.ts',
      vue2: 'src/vue2.ts',
    },
    copy: (options) => ({
      targets: [{ src: resolve(options.root, 'src/types/*'), dest: options.dist }],
    }),
  },
  {
    root: 'packages/webgl-video-editor',
    inputs: {
      'webgl-video-editor': 'src/index.ts',
      elements: 'src/elements/index.ts',
      vue: 'src/vue/index.ts',
    },
    copy: (options) => ({
      targets: [
        { src: resolve(options.root, 'src/locales/*.json'), dest: resolve(options.dist, 'locales') },
        { src: resolve(options.root, 'src/types/*'), dest: options.dist },
      ],
    }),
  },
]

module.exports.packageOptions = packageOptions
