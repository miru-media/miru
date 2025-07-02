<h1>
  <picture>
    <source srcset="./docs/branding/logo/white-logo.svg" media="(prefers-color-scheme: dark)" height="170px" width="100%">
    <img alt="Miru" src="./docs/branding/logo/dark-logo.svg" height="170px" width="100%">
  </picture>
</h1>

[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](code_of_conduct.md)

[Miru](https://miru.media) is a set of modular, extensible Web platform tools and components for still image and multi-track video editing and state-of-the-art, real-time AR. Using WebGL, WebAssembly, and open source, mobile-optimized machine learning models, Miru will give people on the social web the tools to edit images and apply interactive effects to recorded video without compromising on privacy and transparency. Miru aims to provide intuitive and user-friendly UIs which developers can easily integrate into their Web apps regardless of the front-end frameworks they use.

<p class="flex justify-evenly flex-wrap">
    <img src="/webgl-media-editor-screenshot.jpg" alt="Photo editor screenshot" class="h-20rem">
    <img src="/webgl-video-editor-screenshot.jpg" alt="Video editor screenshot" class="h-20rem">
</p>

<!-- #region main -->

## Who is it for?

Web developers who wish to add lightweight media editing to their apps or websites can do so by integrating miru's photo
editor, video editor and video trimmer. These tools are exposed as custom elements which should work in apps using
vanilla JS or any major front-end framework like Vue or React.

```html
<media-trimmer id="trimmer" source="video.mp4"></media-trimmer>
<button id="export" type="buton">Get trimmed video</button>

<script>
// assuming a bundler like Vite is used
import 'media-trimmer'

const trimmer = document.getElementById('trimmer')
const export = document.getElementById('export')

button.addEventListener('click', () => console.log(await trimmer.toBlob()))
trimmer.addEventListener('progress', (event) => console.log('progress:', event.detail.progress))
<script>
```

## Packages

Miru's tools are published to npm as the following packages:

| npm package                                                              | Description                                                      | Docs                              |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------- | --------------------------------- |
| [`webgl-media-editor`](https://www.npmjs.com/package/webgl-media-editor) | A simple image editor with cropping, rotation, and WebGL filters | [docs](/guide/webgl-media-editor) |
| [`media-trimmer`](https://www.npmjs.com/package/media-trimmer)           | A simple MP4 video trimmer using the WebCodecs API               | [docs](/guide/media-trimmer)      |
| [`webgl-effects`](https://www.npmjs.com/package/webgl-effects)           | A library for applying filters and effects to images with WebGL2 |                                   |
| [`webgl-video-editor`](https://www.npmjs.com/package/video-editor)       | A mobile-friendly, multi-track video editor with WebGL effects   | [docs](/guide/webgl-video-editor) |

## Roadmap

This project is still in its early stages. We're working on:

- Still image editor with WebGL filters
  - [x] Crop, rotate, adjustments, and simple filters
  - [ ] Non-linear effect graph
- Video editor
  - Mobile-friendly UI
  - [x] WebGL video effects
  - [ ] Desktop usability improvements
- Real-time AR effects using [MediaPipe](https://github.com/google-ai-edge/mediapipe) and [Three.js](https://threejs.org/)
  - [x] [proof of concept](https://miru.media/ar-effects)
  - [ ] glTF interactivity and face landmark detection extension implementations
  - [ ] Sample effect collection
- [ ] Thorough documentation
- [ ] Translations

<!-- #endregion main -->

## Funding

This project is funded through [NGI Zero Core](https://nlnet.nl/core), a fund established by [NLnet](https://nlnet.nl) with financial support from the European Commission's [Next Generation Internet](https://ngi.eu) program. Learn more at the [NLnet project page](https://nlnet.nl/project/Miru).

<a href="https://nlnet.nl">
  <picture>
    <source srcset="https://nlnet.nl/logo/banner-diapositive.svg" style="width:12.5rem" media="(prefers-color-scheme: dark)" />
    <img src="https://nlnet.nl/logo/banner.svg" style="width:12.5rem" alt="NLnet foundation logo" />
  </picture>
</a>
<a href="https://nlnet.nl/core">
  <picture>
    <source srcset="https://nlnet.nl/image/logos/NGI0_tag_white_mono.svg" style="width:12.5rem" media="(prefers-color-scheme: dark)" />
    <img src="https://nlnet.nl/image/logos/NGI0_tag.svg" style="width:12.5rem" alt="NGI Zero Logo" />
  </picture>
</a>
