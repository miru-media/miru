import turtle from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/turtle-PaulsAdventures-pixabay.mp4'
import underwaterAudio from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/underwater-ambience-freesound_community-pixabay.mp3'
import waveBreaking from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/wave-breaking-EclipseChasers-pixabay.mp4'
import wavesAudio from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/waves-breaking-Dia_Pazon-pixabay.mp3'
import waves from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/waves-MustaKor-pixabay.mp4'
import wavesRocks from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/waves-rocks-McPix22-pixabay.mp4'
import { uid } from 'uid'
import type { Schema } from 'webgl-video-editor'

import { createInitialDocument } from 'webgl-video-editor/store/utils.js'

const transform1080p = {
  position: { x: -420, y: 420 },
  scale: { x: 1.7778, y: 1.7778 },
}

const transform720p = {
  position: { x: -105, y: 600 },
  scale: { x: 2.6667, y: 2.6667 },
}

const assets = {
  waves: {
    id: 'demo:waves',
    type: 'asset:media:av',
    mimeType: 'video/mp4',
    name: `Ocean bird's eye view`,
    url: waves,
    size: 18996712,
    duration: 7.007,
    audio: {
      codec: 'aac',
      duration: 7,
      numberOfChannels: 2,
      sampleRate: 48000,
      firstTimestamp: -0.021333333333333333,
    },
    video: {
      codec: 'avc',
      duration: 7.007,
      rotation: 0,
      width: 1920,
      height: 1080,
      frameRate: 29.97002997002997,
      firstTimestamp: 0,
    },
  },
  wavesRocks: {
    id: 'demo:wavesRocks',
    type: 'asset:media:av',
    mimeType: 'video/mp4',
    name: 'Rocky shore',
    url: wavesRocks,
    size: 21942942,
    duration: 7.007,
    video: {
      codec: 'avc',
      duration: 7.007,
      rotation: 0,
      width: 1920,
      height: 1080,
      frameRate: 29.97002997002997,
      firstTimestamp: 0,
    },
  },
  waveBreaking: {
    id: 'demo:waveBreaking',
    type: 'asset:media:av',
    mimeType: 'video/mp4',
    name: 'Wave breaking',
    url: waveBreaking,
    size: 5384631,
    duration: 10,
    video: {
      codec: 'avc',
      duration: 10,
      rotation: 0,
      width: 1280,
      height: 720,
      frameRate: 25,
      firstTimestamp: 0,
    },
  },
  turtle: {
    id: 'demo:turtle',
    type: 'asset:media:av',
    mimeType: 'video/mp4',
    name: 'Turtle swimming',
    url: turtle,
    size: 8293675,
    duration: 10,
    video: {
      codec: 'avc',
      duration: 10,
      rotation: 0,
      width: 1280,
      height: 720,
      frameRate: 30,
      firstTimestamp: 0,
    },
  },
  wavesAudio: {
    id: 'demo:wavesAudio',
    type: 'asset:media:av',
    mimeType: 'audio/mp3',
    name: 'Waves crashing sounds',
    url: wavesAudio,
    size: 1642579,
    duration: 51.33061224489796,
    audio: {
      codec: 'mp3',
      duration: 51.33061224489796,
      numberOfChannels: 2,
      sampleRate: 44100,
      firstTimestamp: 0,
    },
  },
  underwaterAudio: {
    id: 'demo:underwaterAudio',
    type: 'asset:media:av',
    mimeType: 'audio/mp3',
    name: 'Underwater sounds',
    url: underwaterAudio,
    size: 938400,
    duration: 46.92,
    audio: { codec: 'mp3', duration: 46.92, numberOfChannels: 2, sampleRate: 24000, firstTimestamp: 0 },
  },
} satisfies Record<string, Schema.AvMediaAsset>

export const demoDoc = createInitialDocument()

demoDoc.resolution = { width: 1080, height: 1920 }
demoDoc.frameRate = 24
demoDoc.assets = Object.values(assets)
demoDoc.tracks.push(
  {
    id: uid(),
    type: 'track',
    trackType: 'video',
    children: [
      {
        id: uid(),
        type: 'clip',
        clipType: 'video',
        sourceStart: 3,
        duration: 3,
        source: { assetId: assets.waves.id },
        ...transform1080p,
        filter: { assetId: 'Crispy Cyan', intensity: 1 },
      },
      {
        id: uid(),
        type: 'clip',
        clipType: 'video',
        sourceStart: 2,
        duration: 4,
        source: { assetId: assets.wavesRocks.id },
        ...transform1080p,
        filter: { assetId: 'Crispy Cyan', intensity: 0.5 },
      },
      {
        id: uid(),
        type: 'clip',
        clipType: 'video',
        sourceStart: 3,
        duration: 3,
        source: { assetId: assets.waveBreaking.id },
        ...transform720p,
        filter: { assetId: 'Chromatic', intensity: 0.75 },
      },
      {
        id: uid(),
        type: 'clip',
        clipType: 'video',
        sourceStart: 2.18,
        duration: 5,
        source: { assetId: assets.turtle.id },
        ...transform720p,
        filter: { assetId: 'Vintage', intensity: 0.3 },
      },
      {
        id: uid(),
        type: 'clip',
        clipType: 'video',
        sourceStart: 1,
        duration: 2,
        source: { assetId: assets.waves.id },
        ...transform1080p,
        filter: { assetId: 'Crispy Cyan', intensity: 1 },
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
        sourceStart: 19,
        duration: 10,
        source: { assetId: assets.wavesAudio.id },
      },
      {
        id: uid(),
        type: 'clip',
        clipType: 'audio',
        sourceStart: 0,
        duration: 5,
        source: { assetId: assets.underwaterAudio.id },
      },
      {
        id: uid(),
        type: 'clip',
        clipType: 'audio',
        sourceStart: 16,
        duration: 2,
        source: { assetId: assets.wavesAudio.id },
      },
    ],
  },
)
