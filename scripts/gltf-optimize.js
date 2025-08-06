import { writeFile } from 'node:fs/promises'

import * as gltf from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, instance, palette, prune, resample, sparse, textureCompress } from '@gltf-transform/functions'

import { convertExtrasToExtensions } from 'gltf-ar-effects/effect-creation-utils'
import { CUSTOM_EXTENSIONS } from 'gltf-ar-effects/transform'

const MAX_IMAGE_SIZE = 512

const [, , inFile, outFile] = process.argv

const io = new gltf.NodeIO().registerExtensions([...ALL_EXTENSIONS, ...CUSTOM_EXTENSIONS])

const doc = await io.read(inFile)

await doc.transform(
  convertExtrasToExtensions,
  instance(),
  palette(),
  dedup(),
  resample(),
  prune(),
  sparse(),
  textureCompress({ resize: [MAX_IMAGE_SIZE, MAX_IMAGE_SIZE] }),
)

await writeFile(outFile, await io.writeBinary(doc))
