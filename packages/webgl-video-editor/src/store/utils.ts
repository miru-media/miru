import * as Y from 'yjs'
import { YTree } from 'yjs-orderedtree'

import type { AnyNode } from '../../types/internal'
import type { SerializedMovie } from '../../types/schema'
import { ROOT_NODE_ID } from '../constants.ts'
import type { Movie, Schema } from '../nodes/index.ts'

import { YTREE_NULL_PARENT_KEY, YTREE_ROOT_KEY, YTREE_YMAP_KEY } from './constants.ts'

export const createInitialMovie = (): SerializedMovie =>
  ({
    id: ROOT_NODE_ID,
    type: 'movie',
    assets: [],
    tracks: [],
    resolution: { width: 1920, height: 1080 },
    frameRate: 24,
  }) satisfies SerializedMovie

export const importFromJson = (movie: Movie, content: SerializedMovie) => {
  movie.resolution = content.resolution
  movie.frameRate = content.frameRate

  const createChildren = (parent: AnyNode, childrenInit: Schema.AnyNodeSerializedSchema[]): void => {
    childrenInit.forEach((childInit, index) => {
      const childNode = movie.createNode(childInit)
      childNode.position({ parentId: parent.id, index })
      if ('children' in childInit) createChildren(childNode, childInit.children)
    })
  }

  createChildren(movie.assetLibrary, content.assets)
  createChildren(movie.timeline, content.tracks)
}

export const initYmapFromJson = (ymap: Y.Map<unknown>, content: SerializedMovie) => {
  const ydoc = ymap.doc
  if (!ydoc) throw new Error('YMap must be bound to a doc!')

  ydoc.transact(() => {
    const ytreeMap = new Y.Map()
    ymap.set(YTREE_YMAP_KEY, ytreeMap)

    const ytree = new YTree(ytreeMap)

    ytree.createNode(YTREE_ROOT_KEY, YTREE_NULL_PARENT_KEY, new Y.Map())

    const addNode = (parentKey: string, init: Schema.AnyNodeSerializedSchema) => {
      ytree.createNode(
        parentKey,
        init.id,
        new Y.Map(Object.entries(init).filter(([key]) => key !== 'children')),
      )
      if ('children' in init) init.children.forEach((child) => addNode(init.id, child))
    }

    const movieAsNode = {
      ...content,
      id: ROOT_NODE_ID,
      children: [
        content.assets.length
          ? {
              id: 'asset-library',
              type: 'collection',
              kind: 'asset-library',
              children: content.assets,
            }
          : undefined,
        content.tracks.length
          ? {
              id: 'timeline',
              type: 'collection',
              kind: 'timeline',
              children: content.tracks,
            }
          : undefined,
      ].filter(Boolean),
    }
    addNode(YTREE_ROOT_KEY, movieAsNode)
  })
}
export const createInitialUpdate = (ymap: Y.Map<unknown>): string => {
  initYmapFromJson(ymap, createInitialMovie())

  return Buffer.from(Y.encodeStateAsUpdateV2(ymap.doc!)).toString('base64')
}
