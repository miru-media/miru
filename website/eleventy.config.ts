/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unsafe-call, @typescript-eslint/strict-boolean-expressions -- missing types */
// @ts-nocheck
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { HtmlBasePlugin, IdAttributePlugin, InputPathToUrlTransformPlugin } from '@11ty/eleventy'
import { eleventyImageTransformPlugin } from '@11ty/eleventy-img'
import pluginNavigation from '@11ty/eleventy-navigation'
import pluginSyntaxHighlight from '@11ty/eleventy-plugin-syntaxhighlight'
import EleventyVitePlugin from '@11ty/eleventy-plugin-vite'
import markdownItAttrs from 'markdown-it-attrs'

import pluginFilters from './_config/filters.ts'
import viteOptions from './vite.config.ts'

const MOBILE_IMAGE_WIDTH = 400

export default async (eleventyConfig) => {
  eleventyConfig.addPlugin(EleventyVitePlugin, { viteOptions })
  eleventyConfig.amendLibrary('md', (mdLib) => mdLib.use(markdownItAttrs))
  eleventyConfig.addTemplate(
    'code-of-conduct.md',
    await readFile(resolve(import.meta.dirname, '../CODE_OF_CONDUCT.md'), { title: 'Code of Conduct' }),
  )

  // Drafts, see also _data/eleventyDataSchema.js
  eleventyConfig.addPreprocessor('drafts', '*', (data, _content) => {
    if (data.draft) {
      data.title = `${data.title} (draft)`
    }

    if (data.draft && process.env.ELEVENTY_RUN_MODE === 'build') {
      return false
    }
  })

  // We copy don't the contents of the `public` folder to the output folder here.
  // That's done by the vite plugin instead
  // eleventyConfig.addPassthroughCopy({ './public/': '/', })

  // Run Eleventy when these files change:
  // https://www.11ty.dev/docs/watch-serve/#add-your-own-watch-targets

  // Watch CSS files
  eleventyConfig.addWatchTarget('css/**/*.css')
  // Watch images for the image pipeline.
  eleventyConfig.addWatchTarget('content/**/*.{svg,webp,png,jpg,jpeg,gif}')

  // Per-page bundles, see https://github.com/11ty/eleventy-plugin-bundle
  // Bundle <style> content and adds a {% css %} paired shortcode
  eleventyConfig.addBundle('css', {
    toFileDirectory: 'assets',
    // Add all <style> content to `css` bundle (use <style eleventy:ignore> to opt-out)
    // Supported selectors: https://www.npmjs.com/package/posthtml-match-helper
    bundleHtmlContentFromSelector: 'style',
  })

  // Bundle <script> content and adds a {% js %} paired shortcode
  eleventyConfig.addBundle('js', {
    toFileDirectory: 'assets',
    // Add all <script> content to the `js` bundle (use <script eleventy:ignore> to opt-out)
    // Supported selectors: https://www.npmjs.com/package/posthtml-match-helper
    bundleHtmlContentFromSelector: 'script',
  })

  eleventyConfig.setServerOptions({
    middleware: [
      (req, res, next) => {
        if (req.url.endsWith('.ts')) res.setHeader('Content-Type', 'application/javascript')
        next()
      },
    ],
  })

  // Official plugins
  eleventyConfig.addPlugin(pluginSyntaxHighlight, {
    preAttributes: { tabindex: 0 },
  })
  eleventyConfig.addPlugin(pluginNavigation)
  eleventyConfig.addPlugin(HtmlBasePlugin)
  eleventyConfig.addPlugin(InputPathToUrlTransformPlugin)

  // Image optimization: https://www.11ty.dev/docs/plugins/image/#eleventy-transform
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    // Output formats for each image.
    formats: ['avif', 'webp', 'svg', 'auto'],

    widths: [MOBILE_IMAGE_WIDTH, 'auto'],

    failOnError: false,
    svgShortCircuit: true,
    htmlOptions: {
      imgAttributes: {
        loading: 'lazy',
        decoding: 'async',
      },
    },

    sharpOptions: {
      animated: true,
    },
  })

  // Filters
  eleventyConfig.addPlugin(pluginFilters)

  eleventyConfig.addPlugin(IdAttributePlugin, {
    // by default we use Eleventy’s built-in `slugify` filter:
    // slugify: eleventyConfig.getFilter("slugify"),
    // selector: "h1,h2,h3,h4,h5,h6", // default
  })

  eleventyConfig.addShortcode('currentBuildDate', () => new Date().toISOString())
}

export const config = {
  // Control which files Eleventy will process
  // e.g.: *.md, *.njk, *.html, *.liquid
  templateFormats: ['md', 'njk', 'html', 'liquid', '11ty.js'],

  // Pre-process *.md files with: (default: `liquid`)
  markdownTemplateEngine: 'njk',

  // Pre-process *.html files with: (default: `liquid`)
  htmlTemplateEngine: 'njk',

  dir: {
    input: 'content', // default: "."
    includes: '../_includes', // default: "_includes" (`input` relative)
    data: '../_data', // default: "_data" (`input` relative)
    output: 'dist',
  },
}
