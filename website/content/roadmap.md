---
eleventyNavigation: { key: 'Roadmap', order: 40 }
---

# Roadmap

Miru is under active development. Here's what we've done <span class="task-done" ></span>, what we're currently working on <span class="task-wip"></span>, and what we have planned <span class="task-todo"></span>.

- ## <span class="task-date">2024-11-04</span> <span class="task-done"></span> Photo editing with WebGL filters

  Create A library and UI to crop, rotate, and apply WebGL filters to images. Filters are defined with simple JSON and can use built-in or custom shaders for blending, color adjustments, color LUTs, etc. The web component UI includes:
  - A view for cropping with aspect ratio and rotate buttons, and a zoom slider
  - A view for adjusting brightness, contrast and saturation with a slider
  - A view for selecting a single filter from a horizontal scrolling list with a slider to set the filter intensity

- ## <span class="task-date">2025-01-04</span> <span class="task-done"></span> Integrate image filters into Pixelfed

  The Pixelfed web app now [applies filters with WebGL](https://github.com/pixelfed/pixelfed/pull/5374) using Miru's tools.

- ## <span class="task-date">2025-04-20</span> <span class="task-done"></span> Mobile-friendly video editor

  Multi-track editing of video and audio clips with WebGL filters in a simple, mobile-friendly UI.

- ## <span class="task-date">2025-Q3</span> <span class="task-done"></span> Real-time AR effects

  Using MediaPipe and Three.js, create a proof of concept with glTF interactivity and face landmark detection extension implementations and create a collection of sample AR effects.

  <https://miru.media/ar-effects>

- ## <span class="task-date">2026-Q1</span> <span class="task-done"></span> Media trimmer improvements

  Use Mediabunny, a robust WebCodecs-focused library that will give us support for more formats and enable a smoother editing experience.

- ## <span class="task-date">2026-Q2</span> <span class="task-wip"></span> Documentation

  Make it clear how to get started using Miru's various tools on a web site or app, how to create custom effects, and how to contribute to Miru's development. API reference pages should be generated with TypeDoc or something similar. Write guidelines for contributing translations for Miru's UIs.

- ## <span class="task-date">2026-Q2</span> <span class="task-wip"></span> Video editor improvements

  <!---->
  - Improve the desktop UX
  - Widen input file format suport
  - Add asset management, Text, Subtitles, Images, and stickers
  - Add keyframe animation
  - OpenTimelineIO import and export

- ## <span class="task-date">2026-H1</span> <span class="task-wip"></span> Collaborative video editing

  Add local-first collaborative editing to Miru's video editor using CRDTs. Implement project management, invitations, to run on an existing a self-hostable platform like Nextcloud or NextGraph.

- ## <span class="task-date">2026-H2</span><span class="task-todo"></span> Image editing improvements

  Expand what's possible with Miru's effects by supporting more complex DAGs for effects and create built-in filters using these features. Also add image editing features including:
  - Stripping metadata
  - Quality settings
  - Text and image overlays

- ## <span class="task-date">2026-H2</span> <span class="task-todo"></span> Explore using Miru in social media apps

  Our image filters are currently used in Pixelfed. What other apps might benefit from integration with Miru?
  - Are the editors and AR effects also a good fit for chat apps like Delta Chat?
  - Do users of Loops want a built-in video editor in the web client?
  - Is a React Native or NativeScript implementation feasible and worth implementing?

- ## <span class="task-date">2026-H2</span> <span class="task-todo"></span> Automated video editing tools

  Increase productivity with state-of-the-art tools to perform:
  - Audio transcription
  - Image segmentation
  - Motion tracking

- ## <span class="task-date">2026-H2</span> <span class="task-todo"></span> Media trimmer improvements

  <!---->
  - Lossless trimming
  - Bitrate/filesize controls
  - Preserve color profile
  - Increase browser and codec support with LibAVJS-WebCodecs-Polyfill

- ## <span class="task-date">2027-H1</span> <span class="task-todo"></span> AR effects editor

  Create an app to create AR effects with landmark tracking, post processing effects and filters, and visual scripting for interactivity. The app will include:
  - A 3D scene editor for positioning and previewing objects
  - 3D layer editor
  - An outline for ordering 3D and 2D scenes
  - A node-based visual scripting editor

<style scoped>
li:has(.task-date) {
  list-style: none;
  margin-inline-start: 4rem;

  h2 {
    position: relative;
    border-top: none;
  }

  h2, .task-date {
    margin-top: 1rem;
  }
}

.task-date {
  position: absolute;
  left: -0.5em;
  transform: translateX(-100%);
  font-size: 1rem;
  line-height: 1em;
  vertical-align: top;
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-2)
}
</style>
