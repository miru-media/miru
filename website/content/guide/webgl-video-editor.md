---
outline: false
---

# An embeddable, framework-agnostic, browser-based video editor

[<img src="/media/webgl-video-editor-screenshot.jpg" alt="Screenshot" class="max-h-30rem w-auto">](/video-editor/)

```sh
npm install webgl-video-editor
```

```html
<!-- after importing the library, the <video-editor> custom element will be defined -->
<video-editor id="trimmer" source="video.mp4"></video-editor>
<button id="export" type="buton">Render video</button>

<script>
  import 'webgl-video-editor'

  const editor = document.getElementById('editor')

  // Render and encode the video composition
  button.addEventListener('click', async () => {
    const blob = await editor.export()

    const anchor = document.createElement('a')
    const blobUrl = URL.createObjectURL(blob)

    anchor.href = blobUrl
    anchor.target = '_blank'
    anchor.download = 'trimmed.webm'
    anchor.dispatchEvent(new MouseEvent('click'))
    URL.revokeObjectURL(blobUrl)
  })
</script>
```

Powered by:

- [Mediabunny](https://mediabunny.dev/)
- [WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- [LibAVJS-WebCodecs-Polyfill](https://github.com/ennuicastr/libavjs-webcodecs-polyfill)

Design adapted from [Vladimir Palyanov's work](https://www.figma.com/community/file/991274033166018675/occamus-video-editor)
