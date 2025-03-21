---
title: What is Miru?
---

# What is Miru?

Miru is a set of modular, extensible Web platform tools and components for still image and multi-track video editing.
Miru aims to provide intuitive and user-friendly UIs which developers can easily integrate into their Web apps
regardless of the front-end frameworks they use.

<p class="flex justify-evenly flex-wrap">
    <img src="/webgl-media-editor-screenshot.jpg" alt="Photo editor screenshot" class="h-20rem">
    <img src="/video-editor-screenshot.jpg" alt="Video editor screenshot" class="h-20rem">
</p>

# Who is it for?

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

# Packages

Miru's tools are published to npm as the following packages:

| npm package                                                              | Description                                                      | Docs                              |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------- | --------------------------------- |
| [`webgl-media-editor`](https://www.npmjs.com/package/webgl-media-editor) | A simple image editor with cropping, rotation, and WebGL filters | [docs](/guide/webgl-media-editor) |
| [`media-trimmer`](https://www.npmjs.com/package/media-trimmer)           | A simple MP4 video trimmer using the WebCodecs API               | [docs](/guide/media-trimmer)      |
| [`webgl-effects`](https://www.npmjs.com/package/webgl-effects)           | A library for applying filters and effects to images with WebGL2 |                                   |
| [`miru-video-editor`](https://www.npmjs.com/package/video-editor)            | A mobile-friendly, multi-track video editor with WebGL effects   | [docs](/guide/video-editor)       |