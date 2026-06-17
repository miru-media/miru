const isProd = process.env.NODE_ENV === 'production'

const config = (async () => {
  const imports = /** @type {{ default: (...args: unknown[]) => any }[]} */ (
    await Promise.all([
      import('cssnano'),
      import('postcss-import'),
      import('postcss-preset-env'),
      import('postcss-url'),
      import('@jetbrains/postcss-require-hover'),
    ])
  )
  const [cssnano, postcssImport, presetEnv, url, hover] = imports

  /** @type {import('postcss-load-config').Config} */
  const config = {
    plugins: [
      postcssImport.default(),
      url.default(),
      presetEnv.default(),
      hover.default(),
      isProd && cssnano.default({ preset: 'default' }),
    ],
  }

  return config
})()

module.exports = config
