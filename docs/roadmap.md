# Roadmap

Miru is under active development. Here's what we've done <span class="task-done" />, what we're currently working on <span class="task-wip" />, and what we have planned <span class="task-todo" />.

- ## <span class="task-done" /> Photo editing with WebGL filters

  Create A library and UI to crop, rotate, and apply WebGL filters to images. Filters are defined with simple JSON and can use built-in or custom shaders for blending, color adjustments, color LUTs ,etc. The web component UI includes:
  - A view for cropping with aspect ratio buttons, rotate button and a zoom slider
  - A view for adjusting brightness, contrast and saturation with a slider
  - A view for selecting a single filter from a horizontal scrolling list with a slider to set the filter intensity

- ## <span class="task-done" /> Integrate image filters into Pixelfed

  The Pixelfed web app now [applies filters with WebGL](https://github.com/pixelfed/pixelfed/pull/5374) using Miru's tools.

- ## <span class="task-done" /> Mobile-friendly video editor

  Multie-track editing of video and audio clips with WebGL filters in a simple, mobile-friendly UI.

- ## <span class="task-wip" /> Real-time AR effects

  Using MediaPipe and Three.js, create a proof of concept with glTF interactivity and face landmark detection extension implementations and create a library of sample AR effects.

- ## <span class="task-wip" /> Documentation

  Make it clear how to get started using Miru's various on a web site or app, how to create custom effects, and how to contribute to Miru's development. API reference pages should be generated with TypeDoc or something similar. Write guidelines for contributing translations for Miru's UIs.

- ## <span class="task-todo" /> Advanced image filters

  Expand what's possible with Miru's effects by supporting more complex DAGs for effects and create built-in filters using these features.

- ## <span class="task-todo" /> Media trimmer improvements
  - Mediabunny is a robust WebCodecs-focused library that will give us support for more formats and enable a smoother editing experience
  - Lossless trimming
  - Bitrate/filesize controls
  - Preserve color profile
  - Increase browser and codec support with LibAVJS-WebCodecs-Polyfill

- ## <span class="task-todo" /> Explore using Miru in social media apps

  Our image filters are currently used in Pixelfed. What other apps might benefit from integration with Miru?
  - Are the editors and AR effects also a good fit for chat apps like Delta Chat?
  - Do users of Loops want a built-in video editor in the web client?
  - Is a React Native or NativeScript implementation feasible and worth implementing?

- ## <span class="task-todo" /> Video editor improvements

  Improve the desktop UX, widen input file format suport, add asset management, and add new clip types:
  - Text
  - Images and stickers
  - Subtitles

- ## <span class="task-todo" /> Collaborative video editing

  Add local-first, real-time collaborative editing to Miru's video editor using CRDTs. Implement project management, invitations, and sharing.

- ## <span class="task-todo" /> AI-powered video editing tools

  Increase productivity with state-of-the-art tools to perform:
  - Audio transcription
  - Image segmentation
  - Motion tracking

- ## <span class="task-todo" /> AR effects editor

  An app to create AR effects with landmark tracking, post processing effects and filters, and visual scripting for interactivity. The app will include:
  - A 3D scene editor for positioning and previewing objects
  - 3D layer editor
  - An outline for ordering 3D and 2D scenes
  - A node-based visual scripting editor

<style scoped>
li:has(h2) {
  list-style: none;

  h2 {
    border-top: none;
    margin-top: 1rem;
  }
}
</style>
