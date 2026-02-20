# A video trimmer in the browser

[<img src="https://miru.media/media-trimmer-screenshot.jpg" alt="Screenshot">](https://miru.media/video-trimmer)

<https://miru.media/video-trimmer>

<!-- #region main -->

```sh
npm install media-trimmer
```

```js
import { trim } from 'media-trimmer'

try {
  // The input video must be a `.mp4`/`.mov` file with a video track
  // and the browser must support video encoding with the WebCodecs API
  await trim('video.mp4', {
    start: 2, //    start time in seconds
    end: 10, //     end time in seconds
    mute: false, // ignore the audio track?
  })
} catch (error) {
  alert(error)
}
```

It also comes with a Web Component UI:

```html
<!-- after importing the library, the <media-trimmer> custom element will be defined -->
<media-trimmer id="trimmer" source="video.webm"></media-trimmer>
<button id="export" type="buton">Get trimmed video</button>
<progress id="export-progress" max="1" />

<script type="module">
const trimmer = document.getElementById('trimmer')
const button = document.getElementById('export')
const progress = document.getElementById('export-progress')

// save the trimmed video to a file
button.addEventListener('click', async () => {
  const blob = await trimmer.toBlob()

  const anchor = document.createElement('a')
  const blobUrl = URL.createObjectURL(blob)

  anchor.href = blobUrl
  anchor.target = '_blank'
  anchor.download = 'trimmed.webm'
  anchor.dispatchEvent(new MouseEvent('click'))
  URL.revokeObjectURL(blobUrl)
})

// display the trimming progress
trimmer.addEventListener('progress', (event) => progress.value = event.detail.progress)
<script>
```

Powered by:

- [Mediabunny](https://mediabunny.dev/)
- [WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)

## Roadmap

- [ ] Lossless trimming
- [ ] Bitrate/filesize controls
- [x] Webm support
- [ ] Color profile preservation
- [ ] Increased browser and codec support via [LibAVJS-WebCodecs-Polyfill](https://github.com/ennuicastr/libavjs-webcodecs-polyfill)

<!-- #endregion main -->

## Funding

This project is funded through [NGI Zero Core](https://nlnet.nl/core), a fund established by [NLnet](https://nlnet.nl) with financial support from the European Commission's [Next Generation Internet](https://ngi.eu) program. Learn more at the [NLnet project page](https://nlnet.nl/project/Miru).

[<img src="https://nlnet.nl/logo/banner.png" alt="NLnet foundation logo" width="20%" />](https://nlnet.nl)
[<img src="https://nlnet.nl/image/logos/NGI0_tag.svg" alt="NGI Zero Logo" width="20%" />](https://nlnet.nl/core)
