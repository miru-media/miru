# An image editor with cropping and filters in the browser

https://demo.miru.media/image-editor/

```sh
npm install miru-image-editor
```

```html
<div>
  <!-- after importing the library, these <image-editor-*> custom elements will be defined -->

  <!-- show a preview of the fist image being edited -->
  <image-editor-preview sourceIndex="0"></image-editor-preview>
  <!-- show a menu of filters to apply to the first image -->
  <image-editor-filter-menu sourceIndex="0"></image-editor-filter-menu>

  <image-editor-preview sourceIndex="1"></image-editor-preview>
  <image-editor-filter-menu sourceIndex="1"></image-editor-filter-menu>

  <button id="export" type="buton">Export</button>
</div>
```

```js
import { ImageEditor } from 'miru-image-editor'

const editor = new ImageEditor()

// after creating the editor, give it to the <image-editor-*> elements
const imageEditorElements = document.querySelectorAll('iamge-editor-preview, image-editor-filter-menu')
for (const element of imageEditorElements) {
  element.editor = editor
}
```

// the editor manages a gallery of images, give it an array of sources to edit
editor.setSources(['photo-0.jpg', 'photo-1.jpg'])

// you can edit programatically
editor.setEditState(
// the index of the source image to edit
0,
{
// index of effect. -1 to apply no effect
effect: 2,
// the intensityf of the effect from 0 to 1
intensity: 0.75,
// optional adjustments to apply. adjustment values go from -1 to 1
adjustments?: { brightness: 0, contrast: 0.25, saturation: 0.3 },
// optional crop
crop: { x: 10, y: 10, width: 200, height: 200, rotate: 90 },
}
)

document.getElementById('export').addEventListener('click', async () => {
const image0 = await editor.toBlob(0)
const image1 = await editor.toBlob(1)

window.open(URL.createObjectURL(image0))
window.open(URL.createObjectURL(image1))
})

```

Powered by:

- [Cropper.js](https://fengyuanchen.github.io/cropperjs/)
- [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)

## Funding

This project is funded through [NGI Zero Core](https://nlnet.nl/core), a fund established by [NLnet](https://nlnet.nl) with financial support from the European Commission's [Next Generation Internet](https://ngi.eu) program. Learn more at the [NLnet project page](https://nlnet.nl/project/Miru).

[<img src="https://nlnet.nl/logo/banner.png" alt="NLnet foundation logo" width="20%" />](https://nlnet.nl)
[<img src="https://nlnet.nl/image/logos/NGI0_tag.svg" alt="NGI Zero Logo" width="20%" />](https://nlnet.nl/core)
```
