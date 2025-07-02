const isProd = process.env.NODE_ENV === 'production'

const config = (async () => {
  const imports = /** @type {{ default: (...args: unknown[]) => any }[] } */ (
    await Promise.all([
      import('cssnano'),
      import('postcss-import'),
      import('postcss-preset-env'),
      import('postcss-url'),
      // import('postcss-hover-media-feature')
    ])
  )
  const [cssnano, postcssImport, presetEnv, url] = imports

  /** @type {import('postcss-load-config').Config} */
  const config = {
    plugins: [
      postcssImport.default(),
      url.default(),
      presetEnv.default(),
      isProd && cssnano.default({ preset: 'default' }),
    ],
  }

  return config
})()

module.exports = config
