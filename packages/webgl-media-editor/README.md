# An image editor with cropping and filters in the browser

[<img src="https://miru.media/webgl-media-editor-screenshot.jpg" alt="Screenshot">](https://miru.media/photo-editor)

<https://miru.media/photo-editor>

<!-- #region main -->

```sh
npm install webgl-media-editor
```

```html
<div>
  <!-- after importing the library, these <media-editor-*> custom elements will be defined -->

  <!-- show a preview of the image being edited -->
  <media-editor-preview></media-editor-preview>
  <!-- show a menu of filters to apply to the image -->
  <media-editor-filter-menu></media-editor-filter-menu>

  <button id="export" type="buton">Export</button>
</div>
```

```js
import { MediaEditor } from 'webgl-media-editor'

const editor = new MediaEditor()

// after creating the editor, give it to the <media-editor-*> elements
const mediaEditorElements = document.querySelectorAll('media-editor-preview, media-editor-filter-menu')
for (const element of mediaEditorElements) {
  element.editor = editor
}

// give the editor the URL of an image to load and edit
editor.setSource('photo.jpg')

// you can edit programatically
editor.setEditState({
  // index of effect. -1 to apply no effect
  effect: 2,
  // the intensity of the effect from 0 to 1
  intensity: 0.75,
  // optional adjustments to apply. adjustment values go from -1 to 1
  adjustments: { brightness: 0, contrast: 0.25, saturation: 0.3 },
  // optional crop
  crop: { x: 10, y: 10, width: 200, height: 200, rotate: 90 },
})

document.getElementById('export').addEventListener('click', async () => {
  const blob = await editor.toBlob()

  window.open(URL.createObjectURL(blob))
})
```

Powered by:

- [Cropper.js](https://fengyuanchen.github.io/cropperjs/)
- [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)

<!-- #endregion main -->

## Funding

This project is funded through [NGI Zero Core](https://nlnet.nl/core), a fund established by [NLnet](https://nlnet.nl) with financial support from the European Commission's [Next Generation Internet](https://ngi.eu) program. Learn more at the [NLnet project page](https://nlnet.nl/project/Miru).

[<img src="https://nlnet.nl/logo/banner.png" alt="NLnet foundation logo" width="20%" />](https://nlnet.nl)
[<img src="https://nlnet.nl/image/logos/NGI0_tag.svg" alt="NGI Zero Logo" width="20%" />](https://nlnet.nl/core)
