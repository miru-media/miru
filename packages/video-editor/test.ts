/* eslint-disable no-console */
import { Renderer } from 'webgl-effects'

import { type DemuxerChunkInfo, MP4Demuxer } from 'shared/transcode/demuxer'
import { getWebgl2Context, setObjectSize } from 'shared/utils'

import { AVEncoder } from './export/AVEncoder'

const test = async () => {
  document.body.appendChild(document.createElement('br'))

  const testImageWidth = 40
  const size = { width: testImageWidth, height: testImageWidth * 2 }
  const red = [0xff, 0, 0, 0xff]
  const green = [0, 0xff, 0, 0xff]
  const byteLength = size.width * size.height * 4

  const testBytes = new Uint8ClampedArray(byteLength)
  for (let i = 0; i < byteLength; i += 4) {
    testBytes.set(i < byteLength / 2 ? red : green, i)
  }
  const testImage = new ImageData(testBytes, size.width)

  const fps = 60
  const rotatedSize = { width: size.height, height: size.width }
  const config = { codec: `avc1.4200${(40).toString(16)}`, ...size }
  const av = new AVEncoder({
    video: { ...size, fps, config, rotation: 270 },
    onError: (e) => console.error(e),
  })
  await av.init()

  const bitmap = await createImageBitmap(testImage)
  for (let i = 0; i < 200; i++) {
    const frame = new VideoFrame(bitmap, { duration: 1e6, timestamp: (i * 1e6) / fps })
    av.encodeVideoFrame(frame)
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
  const info = await demuxer.init(url)

  let sample!: DemuxerChunkInfo | undefined
  demuxer.setExtractionOptions(info.videoTracks[0], (s) => (sample ??= s))
  demuxer.start()
  await demuxer.flush()

  const demuxerConfig = demuxer.getConfig(info.videoTracks[0])

  if (!sample) throw new Error(`Demuxer didn't extract any samples`)
  const chunk = new EncodedVideoChunk(sample)
  let decodedFrame: VideoFrame | undefined

  const decoder = new VideoDecoder({
    output: (f) => (decodedFrame = f),
    error: (e) => console.error(e),
  })
  decoder.configure({
    ...demuxerConfig,
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
    bitmapRotatesVideoElement: checkImage(videoElBitmap, 'bitmap <video>'), // false on firefox
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
