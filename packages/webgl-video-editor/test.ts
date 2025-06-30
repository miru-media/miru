/* eslint-disable no-console */
import { Renderer } from 'webgl-effects'

import { getWebgl2Context, setObjectSize } from 'shared/utils'
import { MP4Demuxer } from 'shared/video/mp4/mp4-demuxer'

import { AVEncoder } from './src/export/av-encoder'

const test = async () => {
  document.body.appendChild(document.createElement('br'))

  const testImageWidth = 400
  const size = { width: testImageWidth, height: testImageWidth * 2 }
  const red = [0xff, 0, 0, 0xff]
  const green = [0, 0xff, 0, 0xff]
  const blue = [0, 0, 0xff, 0xff]
  const byteLength = size.width * size.height * 4

  const testBytes = new Uint8ClampedArray(byteLength)
  for (let i = 0; i < byteLength; i += 4) {
    const { width, height } = size
    const x = Math.floor(i / 4) % width
    const y = Math.floor(i / width / 4)

    if (Math.abs(x / width - 0.5) < 0.125 && Math.abs(y / height - 0.5) < 0.365) testBytes.set(blue, i)
    else testBytes.set(y < height / 2 ? red : green, i)
  }
  const testImage = new ImageData(testBytes, size.width)

  const framerate = 1
  const rotatedSize = { width: size.height, height: size.width }
  const config = { codec: `avc1.4200${(40).toString(16)}`, ...size, framerate, rotation: 270 as const }
  const av = new AVEncoder({ video: config })
  await av.init()

  const bitmap = await createImageBitmap(testImage)
  const writer = av.video!.getWriter()
  for (let i = 0; i < 10; i++) {
    const frame = new VideoFrame(bitmap, { duration: 1e6, timestamp: (i * 1e6) / framerate })
    await writer.write(frame)
    frame.close()
  }

  await av.flush()
  const buffer = av.finalize()

  const demuxer = new MP4Demuxer()
  const blob = new Blob([buffer])
  const url = URL.createObjectURL(blob)

  const videoEl = document.body.appendChild(document.createElement('video'))
  document.body.appendChild(document.createElement('br'))
  videoEl.src = url
  videoEl.preload = 'auto'
  videoEl.muted = true

  const videoElLoaded = new Promise((resolve, reject) => {
    videoEl.addEventListener('canplaythrough', resolve)
    videoEl.addEventListener('error', reject)
  })
    .then(() => videoEl.play())
    .then(() => new Promise((r) => setTimeout(r, 200)))
  const videoInfo = (await demuxer.init((await fetch(url)).body!)).video!

  const chunks = demuxer.getChunkStream(videoInfo)
  demuxer.start()
  const { value: sample } = await chunks.getReader().read()

  if (!sample) throw new Error(`Demuxer didn't extract any samples`)
  const chunk = new EncodedVideoChunk(sample)
  let decodedFrame: VideoFrame | undefined

  const decoder = new VideoDecoder({
    output: (f) => (decodedFrame = f),
    error: (e) => console.error(e),
  })
  decoder.configure({
    ...videoInfo,
    ...config,
    hardwareAcceleration: 'prefer-software',
  })
  decoder.decode(chunk)
  await decoder.flush()

  if (!decodedFrame) throw new Error('Nothing was decoded')

  const gl = getWebgl2Context()
  const renderer = new Renderer({ gl })
  renderImage(renderer, decodedFrame)

  await videoElLoaded

  const videoFrameBitmap = await createImageBitmap(decodedFrame)
  const videoElBitmap = await createImageBitmap(videoEl)
  const videoElVideoFrame = new VideoFrame(videoEl)

  const result = {
    bitmapOfVideoElementHasRotatedSize: videoElBitmap.width === rotatedSize.width, // true only on safari
    bitmapOfVideoFrameHasRotatedSize: videoFrameBitmap.width === rotatedSize.width, // always false
    videoFrameOfVideoElementHasRotatedSize: videoElBitmap.width === rotatedSize.width, // true only on safari
    bitmapRotatesVideoFrame: checkImage(videoFrameBitmap, 'bitmap VideoFrame'), // always false
    bitmapRotatesVideoElement: checkImage(videoElBitmap, 'bitmap <video>'), // false only on firefox
    videoFrameRotatesVideoElement: checkImage(videoElVideoFrame, 'videoFrame VideoFrame'), // matches bitmap <video>
    context2dRotatesVideoFrame: checkImage(decodedFrame, '2d VideoFrame'), // always false
    context2dRotatesVideoElement: checkImage(videoEl, '2d <video>'), // alwasy true
    webglRotatesVideoFrame: checkImage(gl.canvas, 'Webgl VideoFrame'), // always false
    webglRotatesVideoElement: checkImage(videoEl, 'webgl <video>'), // test result is always true, but this doesn't match the video editor behaviour on Firefox
  }

  console.table(result)
  console.log({ decodedFrame, videoFrameBitmap, videoElBitmap })

  return result

  function renderImage(renderer: Renderer, image: TexImageSource) {
    const texture = renderer.createTexture()

    const fb = renderer.createFramebufferAndTexture(rotatedSize)

    renderer.loadImage(texture, image)
    renderer.setSourceTexture(texture, rotatedSize, rotatedSize)
    renderer.draw(fb.framebuffer)

    renderer.setSourceTexture(fb.texture, rotatedSize, rotatedSize)
    renderer.draw()

    renderer.waitSync()

    renderer.deleteTexture(texture)
    renderer.deleteFramebuffer(fb.framebuffer)
    renderer.deleteTexture(fb.texture)
  }

  function checkImage(image: CanvasImageSource, label: string) {
    const { width, height } = rotatedSize
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')!
    setObjectSize(canvas, rotatedSize)
    canvas.setAttribute('style', 'border: solid 2px blue; margin: 8px; width: 100px')
    canvas.title = label
    document.body.appendChild(canvas)

    context.fillStyle = 'black'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)

    const bytes = context.getImageData(0, 0, width, height).data

    // expect pixels to match rotated image, with tolerance for browser's fingerprint resistance
    const half = 0xff / 2
    {
      // top left pixel (red)
      const [r, g, b] = bytes.slice(0, 4)
      if (r < half || g + b > half) return false
    }
    {
      // top right pixel (green)
      const [r, g, b] = bytes.slice((width - 1) * 4, width * 4)
      if (g < half || r + b > half) return false
    }

    return true
  }
}

setTimeout(() => void test().catch(console.error), 100)

window.onclick = test
