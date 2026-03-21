import { expect, test } from 'vitest'

import { Document } from '../src/document.ts'
import { documentToOTIO } from '../src/otio/export.ts'
import { documentJSONFromOTIO } from '../src/otio/import.ts'

import { simpleDocWithAudioVideoClips } from './test-content.ts'

test('OTIO export is as expected', () => {
  using doc = new Document({})
  doc.importFromJson(simpleDocWithAudioVideoClips())

  expect(documentToOTIO(doc)).toMatchSnapshot()
})

test('OTIO roundtrips to same content', () => {
  using doc = new Document({})
  using docFromOtio = new Document({})

  doc.importFromJson(simpleDocWithAudioVideoClips())

  docFromOtio.importFromJson(documentJSONFromOTIO(documentToOTIO(doc)))

  expect(doc.toJSON()).toEqual(docFromOtio.toJSON())
})
