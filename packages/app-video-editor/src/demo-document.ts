/* eslint-disable @typescript-eslint/no-magic-numbers -- -- */
import turtle from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/turtle-PaulsAdventures-pixabay.mp4'
import turtleThumbnail from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/turtle-PaulsAdventures-pixabay.mp4.webp'
import underwaterAudio from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/underwater-ambience-freesound_community-pixabay.mp3'
import waveBreaking from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/wave-breaking-EclipseChasers-pixabay.mp4'
import waveBreakingThumbnail from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/wave-breaking-EclipseChasers-pixabay.mp4.webp'
import wavesAudio from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/waves-breaking-Dia_Pazon-pixabay.mp3'
import waves from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/waves-MustaKor-pixabay.mp4'
import wavesThumbnail from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/waves-MustaKor-pixabay.mp4.webp'
import wavesRocks from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/waves-rocks-McPix22-pixabay.mp4'
import wavesRocksThumbnail from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/waves-rocks-McPix22-pixabay.mp4.webp'
import { uid } from 'uid'
import type { Schema } from 'webgl-video-editor'

import { Rational } from 'shared/utils/index.ts'
import { createInitialDocument } from 'webgl-video-editor/sync'

const scale1080p = { scaleX: 1.7778, scaleY: 1.7778 }
const scale720p = { scaleX: 2.6667, scaleY: 2.6667 }

const scaleWaves = { scaleX: 1.9, scaleY: 1.9 }
const EASE_OUT = [0.17, 0.84, 0.44, 1] as const

const audioFadeDuration = new Rational(2, 20)
const fadeIn = (clip: Schema.AudioClip) => {
  ;((clip.animations ??= {}).volume ??= { keyframes: [] }).keyframes.push(
    { value: 0, dt: { value: 0, rate: 1 }, easing: 'linear' },
    { value: 1, dt: audioFadeDuration.toJSON(), easing: 'linear' },
  )
  return clip
}

const fadeOut = (clip: Schema.AudioClip) => {
  ;((clip.animations ??= {}).volume ??= { keyframes: [] }).keyframes.push(
    {
      value: 1,
      dt: Rational.from(clip.duration)
        .subtract(audioFadeDuration)
        .subtract(clip.animations.volume.keyframes.reduce((acc, k) => acc.add(k.dt), Rational.ZERO))
        .toJSON(),
      easing: 'linear',
    },
    { value: 0, dt: audioFadeDuration.toJSON(), easing: 'linear' },
  )
  return clip
}

const assets = {
  waves: {
    id: 'demo:waves',
    type: 'asset:media:av',
    mimeType: 'video/mp4',
    name: `Ocean bird's eye view`,
    uri: waves,
    thumbnailUri: wavesThumbnail,
    size: 18996712,
    duration: 7.007,
    audio: {
      codec: 'aac',
      duration: { value: 210210, rate: 30000 },
      numberOfChannels: 2,
      sampleRate: 48000,
      firstTimestamp: { value: -640, rate: 30000 },
    },
    video: {
      codec: 'avc',
      duration: { value: 336000, rate: 48000 },
      rotation: 0,
      width: 1920,
      height: 1080,
      frameRate: 29.97002997002997,
      firstTimestamp: { value: 0, rate: 48000 },
    },
  },
  wavesRocks: {
    id: 'demo:wavesRocks',
    type: 'asset:media:av',
    mimeType: 'video/mp4',
    name: 'Rocky shore',
    uri: wavesRocks,
    thumbnailUri: wavesRocksThumbnail,
    size: 21942942,
    duration: 7.007,
    video: {
      codec: 'avc',
      duration: { value: 210210, rate: 30000 },
      rotation: 0,
      width: 1920,
      height: 1080,
      frameRate: 29.97002997002997,
      firstTimestamp: { value: 0, rate: 30000 },
    },
  },
  waveBreaking: {
    id: 'demo:waveBreaking',
    type: 'asset:media:av',
    mimeType: 'video/mp4',
    name: 'Wave breaking',
    uri: waveBreaking,
    thumbnailUri: waveBreakingThumbnail,
    size: 5384631,
    duration: 10,
    video: {
      codec: 'avc',
      duration: { value: 128000, rate: 12800 },
      rotation: 0,
      width: 1280,
      height: 720,
      frameRate: 25,
      firstTimestamp: { value: 0, rate: 12800 },
    },
  },
  turtle: {
    id: 'demo:turtle',
    type: 'asset:media:av',
    mimeType: 'video/mp4',
    name: 'Turtle swimming',
    uri: turtle,
    thumbnailUri: turtleThumbnail,
    size: 8293675,
    duration: 10,
    video: {
      codec: 'avc',
      duration: { value: 153600, rate: 15360 },
      rotation: 0,
      width: 1280,
      height: 720,
      frameRate: 30,
      firstTimestamp: { value: 0, rate: 15360 },
    },
  },
  wavesAudio: {
    id: 'demo:wavesAudio',
    type: 'asset:media:av',
    mimeType: 'audio/mp3',
    name: 'Waves crashing sounds',
    uri: wavesAudio,
    size: 1642579,
    duration: 51.33061224489796,
    audio: {
      codec: 'mp3',
      duration: { value: 62880, rate: 1225 },
      numberOfChannels: 2,
      sampleRate: 44100,
      firstTimestamp: { value: 0, rate: 1225 },
    },
  },
  underwaterAudio: {
    id: 'demo:underwaterAudio',
    type: 'asset:media:av',
    mimeType: 'audio/mp3',
    name: 'Underwater sounds',
    uri: underwaterAudio,
    size: 938400,
    duration: 46.92,
    audio: {
      codec: 'mp3',
      duration: { value: 5865, rate: 125 },
      numberOfChannels: 2,
      sampleRate: 24000,
      firstTimestamp: { value: 0, rate: 125 },
    },
  },
} satisfies Record<string, Schema.AnyAsset>

export const demoDoc = createInitialDocument()

const mainVideoTrack: Schema.SerializedVideoTrack = {
  id: uid(),
  type: 'track:video',
  children: [
    {
      id: uid(),
      type: 'clip:video',
      name: assets.waves.name,
      sourceStart: { value: 90000, rate: 30000 },
      duration: { value: 90000, rate: 30000 },
      mediaRef: { id: assets.waves.id, type: 'asset:media:av' },
      ...scaleWaves,
      effects: [{ id: uid(), assetId: 'filter:Crispy Cyan', intensity: 1 }],
      animations: {
        translateX: { keyframes: [{ value: 0, dt: { value: 0, rate: 1 }, easing: 'linear' }] },
        translateY: {
          keyframes: [
            { value: 0, dt: { value: 0, rate: 1 }, easing: 'linear' },
            { value: 50, dt: { value: 3, rate: 1 }, easing: 'linear' },
          ],
        },
      },
    },
    {
      id: uid(),
      type: 'clip:video',
      name: assets.wavesRocks.name,
      sourceStart: { value: 60000, rate: 30000 },
      duration: { value: 120000, rate: 30000 },
      mediaRef: { id: assets.wavesRocks.id, type: 'asset:media:av' },
      ...scale1080p,
      effects: [{ id: uid(), assetId: 'filter:Crispy Cyan', intensity: 0.5 }],
    },
    {
      id: uid(),
      type: 'clip:video',
      name: assets.waveBreaking.name,
      sourceStart: { value: 38400, rate: 12800 },
      duration: { value: 38400, rate: 12800 },
      mediaRef: { id: assets.waveBreaking.id, type: 'asset:media:av' },
      ...scale720p,
      effects: [{ id: uid(), assetId: 'filter:Chromatic', intensity: 0.75 }],
    },
    {
      id: uid(),
      type: 'clip:video',
      name: assets.turtle.name,
      sourceStart: { value: 33484, rate: 15360 },
      duration: { value: 76800, rate: 15360 },
      mediaRef: { id: assets.turtle.id, type: 'asset:media:av' },
      ...scale720p,
      effects: [{ id: uid(), assetId: 'filter:Vintage', intensity: 0.3 }],
    },
    {
      id: uid(),
      type: 'clip:video',
      name: assets.waves.name,
      sourceStart: { value: 30000, rate: 30000 },
      duration: { value: 60000, rate: 30000 },
      mediaRef: { id: assets.waves.id, type: 'asset:media:av' },
      ...scaleWaves,
      effects: [{ id: uid(), assetId: 'filter:Crispy Cyan', intensity: 1 }],
      animations: {
        translateX: { keyframes: [{ value: 0, dt: { value: 0, rate: 1 }, easing: 'linear' }] },
        translateY: {
          keyframes: [
            { value: -50, dt: { value: 0, rate: 1 }, easing: 'linear' },
            { value: 0, dt: { value: 2, rate: 1 }, easing: 'linear' },
          ],
        },
      },
    },
  ],
}

const mainAudioTrack: Schema.SerializedAudioTrack = {
  id: uid(),
  type: 'track:audio',
  children: mainVideoTrack.children.map(({ name, sourceStart, duration }) => ({
    id: uid(),
    type: 'clip:audio',
    name,
    sourceStart,
    duration,
  })),
}

demoDoc.resolution = { width: 1080, height: 1920 }
demoDoc.frameRate = 24
demoDoc.assets = Object.values(assets)
demoDoc.timeline.children.push(
  {
    id: uid(),
    type: 'track:video',
    children: [
      {
        id: uid(),
        type: 'clip:text',
        duration: { value: 2, rate: 1 },
        sourceStart: { value: 0, rate: 1 },
        translateY: 600,
        content: 'Hello world!',
        fontFamily: 'Arial',
        fontSize: 250,
        inlineSize: 800,
        fill: 'white',
        gap: { value: 2, rate: 1 },
        animations: {
          translateX: {
            keyframes: [
              { value: -40, dt: { value: 0, rate: 1 }, easing: EASE_OUT },
              { value: 120, dt: { value: 2, rate: 1 }, easing: EASE_OUT },
            ],
          },
          translateY: {
            keyframes: [{ value: 0, dt: { value: 0, rate: 1 }, easing: EASE_OUT }],
          },
        },
      },
    ],
  },
  mainVideoTrack,
  mainAudioTrack,
  {
    id: uid(),
    type: 'track:audio',
    children: [
      fadeOut({
        id: uid(),
        type: 'clip:audio',
        name: assets.wavesAudio.name,
        sourceStart: { value: 23275, rate: 1225 },
        duration: audioFadeDuration.scale(0.5).add({ value: 12250, rate: 1225 }).toJSON(),
        mediaRef: { id: assets.wavesAudio.id, type: 'asset:media:av' },
      }),
      fadeIn({
        id: uid(),
        type: 'clip:audio',
        name: assets.wavesAudio.name,
        sourceStart: { value: 19600, rate: 1225 },
        duration: audioFadeDuration.scale(0.5).add({ value: 2450, rate: 1225 }).toJSON(),
        gap: Rational.from({ value: 625, rate: 125 }).subtract(audioFadeDuration).toJSON(),
        mediaRef: { id: assets.wavesAudio.id, type: 'asset:media:av' },
      }),
    ],
  },
  {
    id: uid(),
    type: 'track:audio',
    children: [
      fadeOut(
        fadeIn({
          id: uid(),
          type: 'clip:audio',
          name: assets.underwaterAudio.name,
          sourceStart: { value: 0, rate: 125 },
          duration: audioFadeDuration.add({ value: 625, rate: 125 }).toJSON(),
          gap: Rational.from({ value: 12250, rate: 1225 }).subtract(audioFadeDuration.scale(0.5)).toJSON(),
          mediaRef: { id: assets.underwaterAudio.id, type: 'asset:media:av' },
        }),
      ),
    ],
  },
)

const toLinkItem = (node: Schema.Linkable): Schema.NodeLink['nodes'][number] => ({
  id: node.id,
  type: node.type,
})

demoDoc.links.push(
  {
    id: uid(),
    nodes: [toLinkItem(mainVideoTrack), toLinkItem(mainAudioTrack)],
  },
  ...mainVideoTrack.children.map((video, index) => ({
    id: uid(),
    nodes: [toLinkItem(video), toLinkItem(mainAudioTrack.children[index])],
  })),
)
