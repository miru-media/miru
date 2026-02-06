import turtle from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/turtle-PaulsAdventures-pixabay.mp4'
import underwaterAudio from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/underwater-ambience-freesound_community-pixabay.mp3'
import waveBreaking from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/wave-breaking-EclipseChasers-pixabay.mp4'
import wavesAudio from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/waves-breaking-Dia_Pazon-pixabay.mp3'
import waves from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/waves-MustaKor-pixabay.mp4'
import wavesRocks from 'https://github.com/miru-media/static-assets/raw/main/dist/demo/waves-rocks-McPix22-pixabay.mp4'
import { uid } from 'uid'
import { getDefaultFilterDefinitions } from 'webgl-effects'
import type { Schema } from 'webgl-video-editor'

import { createInitialMovie } from 'webgl-video-editor/store/utils.js'

const filters = getDefaultFilterDefinitions().map((def) => ({
  ...def,
  id: def.id!,
  type: 'asset:effect:video' as const,
}))

const assets = {
  waves: {
    id: 'demo:waves',
    type: 'asset:media:av',
    mimeType: 'video/mp4',
    name: `Ocean bird's eye view`,
    url: waves,
    duration: 7.021333,
    video: { duration: 7.021333, rotation: 0 },
  },
  wavesRocks: {
    id: 'demo:wavesRocks',
    type: 'asset:media:av',
    mimeType: 'video/mp4',
    name: 'Rocky shore',
    url: wavesRocks,
    duration: 7.07,
    video: { duration: 7.07, rotation: 0 },
  },
  waveBreaking: {
    id: 'demo:waveBreaking',
    type: 'asset:media:av',
    mimeType: 'video/mp4',
    name: 'Wave breaking',
    url: waveBreaking,
    duration: 10,
    video: { duration: 10, rotation: 0 },
  },
  turtle: {
    id: 'demo:turtle',
    type: 'asset:media:av',
    mimeType: 'video/mp4',
    name: 'Turtle swimming',
    url: turtle,
    duration: 10,
    video: { duration: 10, rotation: 0 },
  },
  wavesAudio: {
    id: 'demo:wavesAudio',
    type: 'asset:media:av',
    mimeType: 'audio/mp3',
    name: 'Waves crashing sounds',
    url: wavesAudio,
    duration: 51.330594,
    audio: { duration: 51.330594 },
  },
  underwaterAudio: {
    id: 'demo:underwaterAudio',
    type: 'asset:media:av',
    mimeType: 'audio/mp3',
    name: 'Underwater sounds',
    url: underwaterAudio,
    duration: 46.92,
    audio: { duration: 46.92 },
  },
} satisfies Record<string, Schema.AvMediaAsset>

export const demoMovie = createInitialMovie(uid)

demoMovie.resolution = { width: 1080, height: 1920 }
demoMovie.frameRate = 24
demoMovie.assets = [...Object.values(assets), ...filters]
demoMovie.tracks[0].children = [
  {
    id: uid(),
    type: 'clip',
    sourceStart: 3,
    duration: 3,
    source: { assetId: assets.waves.id },
    filter: { assetId: 'Crispy Cyan', intensity: 1 },
  },
  {
    id: uid(),
    type: 'clip',
    sourceStart: 2,
    duration: 4,
    source: { assetId: assets.wavesRocks.id },
    filter: { assetId: 'Crispy Cyan', intensity: 0.5 },
  },
  {
    id: uid(),
    type: 'clip',
    sourceStart: 3,
    duration: 3,
    source: { assetId: assets.waveBreaking.id },
    filter: { assetId: 'Chromatic', intensity: 0.75 },
  },
  {
    id: uid(),
    type: 'clip',
    sourceStart: 2.18,
    duration: 5,
    source: { assetId: assets.turtle.id },
    filter: { assetId: 'Vintage', intensity: 0.3 },
  },
  {
    id: uid(),
    type: 'clip',
    sourceStart: 1,
    duration: 2,
    source: { assetId: assets.waves.id },
    filter: { assetId: 'Crispy Cyan', intensity: 1 },
  },
]

demoMovie.tracks[1].children = [
  {
    id: uid(),
    type: 'clip',
    sourceStart: 19,
    duration: 10,
    source: { assetId: assets.wavesAudio.id },
  },
  {
    id: uid(),
    type: 'clip',
    sourceStart: 0,
    duration: 5,
    source: { assetId: assets.underwaterAudio.id },
  },
  {
    id: uid(),
    type: 'clip',
    sourceStart: 16,
    duration: 2,
    source: { assetId: assets.wavesAudio.id },
  },
]
