import turtle from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/turtle-PaulsAdventures-pixabay.mp4'
import underwaterAudio from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/underwater-ambience-freesound_community-pixabay.mp3'
import waveBreaking from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/wave-breaking-EclipseChasers-pixabay.mp4'
import wavesAudio from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/waves-breaking-Dia_Pazon-pixabay.mp3'
import waves from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/waves-MustaKor-pixabay.mp4'
import wavesRocks from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/waves-rocks-McPix22-pixabay.mp4'
import { uid } from 'uid'
import { getDefaultFilterDefinitions } from 'webgl-effects'
import type { Schema } from 'webgl-video-editor'

import { createInitialDocument } from 'webgl-video-editor/sync'

const scale1080p = { x: 1.7778, y: 1.7778 }
const scale720p = { x: 2.6667, y: 2.6667 }

const assets = {
  waves: {
    id: 'demo:waves',
    type: 'asset:media:av',
    mimeType: 'video/mp4',
    name: `Ocean bird's eye view`,
    uri: waves,
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
  ...Object.fromEntries(
    getDefaultFilterDefinitions().map((def): [string, Schema.VideoEffectAsset] => {
      const id = `filter:${def.id!}`

      return [id, { ...def, id, type: 'asset:effect:video' }]
    }),
  ),
} satisfies Record<string, Schema.MediaAsset>

export const demoDoc = createInitialDocument()

demoDoc.resolution = { width: 1080, height: 1920 }
demoDoc.frameRate = 24
demoDoc.assets = Object.values(assets)
demoDoc.timeline.children.push(
  {
    id: uid(),
    type: 'track',
    trackType: 'video',
    children: [
      {
        id: uid(),
        type: 'clip',
        clipType: 'video',
        name: assets.waves.name,
        sourceStart: { value: 90000, rate: 30000 },
        duration: { value: 90000, rate: 30000 },
        mediaRef: { assetId: assets.waves.id },
        scale: scale1080p,
        effects: [{ id: uid(), assetId: 'filter:Crispy Cyan', intensity: 1 }],
      },
      {
        id: uid(),
        type: 'clip',
        clipType: 'video',
        name: assets.wavesRocks.name,
        sourceStart: { value: 60000, rate: 30000 },
        duration: { value: 120000, rate: 30000 },
        mediaRef: { assetId: assets.wavesRocks.id },
        scale: scale1080p,
        effects: [{ id: uid(), assetId: 'filter:Crispy Cyan', intensity: 0.5 }],
      },
      {
        id: uid(),
        type: 'clip',
        clipType: 'video',
        name: assets.waveBreaking.name,
        sourceStart: { value: 38400, rate: 12800 },
        duration: { value: 38400, rate: 12800 },
        mediaRef: { assetId: assets.waveBreaking.id },
        scale: scale720p,
        effects: [{ id: uid(), assetId: 'filter:Chromatic', intensity: 0.75 }],
      },
      {
        id: uid(),
        type: 'clip',
        clipType: 'video',
        name: assets.turtle.name,
        sourceStart: { value: 33484, rate: 15360 },
        duration: { value: 76800, rate: 15360 },
        mediaRef: { assetId: assets.turtle.id },
        scale: scale720p,
        effects: [{ id: uid(), assetId: 'filter:Vintage', intensity: 0.3 }],
      },
      {
        id: uid(),
        type: 'clip',
        clipType: 'video',
        name: assets.waves.name,
        sourceStart: { value: 30000, rate: 30000 },
        duration: { value: 60000, rate: 30000 },
        mediaRef: { assetId: assets.waves.id },
        scale: scale1080p,
        effects: [{ id: uid(), assetId: 'filter:Crispy Cyan', intensity: 1 }],
      },
    ],
  },
  {
    id: uid(),
    type: 'track',
    trackType: 'audio',
    children: [
      {
        id: uid(),
        type: 'clip',
        clipType: 'audio',
        name: assets.wavesAudio.name,
        sourceStart: { value: 23275, rate: 1225 },
        duration: { value: 12250, rate: 1225 },
        mediaRef: { assetId: assets.wavesAudio.id },
      },
      {
        id: uid(),
        type: 'clip',
        clipType: 'audio',
        name: assets.underwaterAudio.name,
        sourceStart: { value: 0, rate: 125 },
        duration: { value: 625, rate: 125 },
        mediaRef: { assetId: assets.underwaterAudio.id },
      },
      {
        id: uid(),
        type: 'clip',
        clipType: 'audio',
        name: assets.wavesAudio.name,
        sourceStart: { value: 19600, rate: 1225 },
        duration: { value: 2450, rate: 1225 },
        mediaRef: { assetId: assets.wavesAudio.id },
      },
    ],
  },
)
