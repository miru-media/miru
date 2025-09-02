# An embeddable, framework-agnostic, browser-based video editor

[<img src="https://miru.media/webgl-video-editor-screenshot.jpg" alt="Screenshot">](https://miru.media/video-editor)

<https://miru.media/video-editor>

<!-- #region main -->

```sh
npm install webgl-video-editor
```

```html
<!-- after importing the library, the <video-editor> custom element will be defined -->
<video-editor id="trimmer" source="video.mp4"></video-editor>

<button id="export" type="buton">Get trimmed video</button>

<script>
  import 'webgl-video-editor'

  const editor = document.getElementById('editor')

  async function restoreFromLocalStorage() {
    try {
      const savedJson = localStorage.getItem(movieContentKey)

      if (savedJson) {
        const parsed = JSON.parse(savedJson)
        return editor.replaceContent(parsed)
      }
    } catch (error) {
      console.error(error)
    }
  }

  restoreFromLocalStorage()

  // save to localStorage when the content changes
  editor.addEventListener('change', function (event) {
    localStorage.setItem(movieContentKey, JSON.stringify(event.detail))
  })
</script>
```

Powered by:

- [mp4Box.js](https://gpac.github.io/mp4box.js/)
- [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) and [webm-muxer](https://github.com/Vanilagy/webm-muxer)
- [WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- [LibAVJS-WebCodecs-Polyfill](https://github.com/ennuicastr/libavjs-webcodecs-polyfill)

Design adapted from [Vladimir Palyanov's work](https://www.figma.com/community/file/991274033166018675/occamus-video-editor)

<!-- #endregion main -->

## Funding

This project is funded through [NGI Zero Core](https://nlnet.nl/core), a fund established by [NLnet](https://nlnet.nl) with financial support from the European Commission's [Next Generation Internet](https://ngi.eu) program. Learn more at the [NLnet project page](https://nlnet.nl/project/Miru).

[<img src="https://nlnet.nl/logo/banner.png" alt="NLnet foundation logo" width="20%" />](https://nlnet.nl)
[<img src="https://nlnet.nl/image/logos/NGI0_tag.svg" alt="NGI Zero Logo" width="20%" />](https://nlnet.nl/core)
