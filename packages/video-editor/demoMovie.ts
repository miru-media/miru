/* eslint-disable import/no-unresolved */
import turtle from 'https://assets.miru.media/demo/turtle-PaulsAdventures-pixabay.mp4'
import underwaterAudio from 'https://assets.miru.media/demo/underwater-ambience-freesound_community-pixabay.mp3'
import waveBreaking from 'https://assets.miru.media/demo/wave-breaking-EclipseChasers-pixabay.mp4'
import wavesAudio from 'https://assets.miru.media/demo/waves-breaking-Dia_Pazon-pixabay.mp3'
import waves from 'https://assets.miru.media/demo/waves-MustaKor-pixabay.mp4'
import wavesRocks from 'https://assets.miru.media/demo/waves-rocks-McPix22-pixabay.mp4'
import { uid } from 'uid'
/* eslint-enable import/no-unresolved */
import { getDefaultFilterDefinitions } from 'webgl-effects'

import { type Schema } from './nodes'

const filters = getDefaultFilterDefinitions().map((def) => ({
  ...def,
  id: def.id ?? '',
  type: 'video_effect_asset' as const,
}))

const assets = {
  waves: {
    id: 'demo:waves',
    type: 'av_media_asset',
    url: waves,
    duration: 7.021333,
    video: { duration: 7.021333, rotation: 0 },
  },
  wavesRocks: {
    id: 'demo:wavesRocks',
    type: 'av_media_asset',
    url: wavesRocks,
    duration: 7.07,
    video: { duration: 7.07, rotation: 0 },
  },
  waveBreaking: {
    id: 'demo:waveBreaking',
    type: 'av_media_asset',
    url: waveBreaking,
    duration: 10,
    video: { duration: 10, rotation: 0 },
  },
  turtle: {
    id: 'demo:turtle',
    type: 'av_media_asset',
    url: turtle,
    duration: 10,
    video: { duration: 10, rotation: 0 },
  },
  wavesAudio: {
    id: 'demo:wavesAudio',
    type: 'av_media_asset',
    url: wavesAudio,
    duration: 51.330594,
    video: { duration: 51.330594, rotation: 0 },
  },
  underwaterAudio: {
    id: 'demo:underwaterAudio',
    type: 'av_media_asset',
    url: underwaterAudio,
    duration: 46.92,
    video: { duration: 46.92, rotation: 0 },
  },
} satisfies Record<string, Schema.AvMediaAsset>

export const demoMovie: Schema.Movie = {
  id: uid(),
  type: 'movie',
  assets: [...Object.values(assets), ...filters],
  children: [
    {
      id: uid(),
      type: 'track',
      trackType: 'video',
      children: [
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
      ],
    },
  ],
  resolution: { width: 1080, height: 1920 },
  frameRate: 24,
}
