/* eslint-disable vitest/no-disabled-tests, vitest/expect-expect -- TODO */
import { describe, test } from 'vitest'

describe(`resizing clip start edge`, () => {
  test(`-->[clip]: creates a gap, duration reduces, clip end is unchanged`)

  describe(`[gap] <--[clip]`, () => {
    test(`gap duration changes with clip start`)

    test(`gap is deleted when the clip is resized to start at former gap start`)
  })
})

describe(`resizing clip end edge`, () => {
  test(`[gap] [clip]-->: clip duration is increased; no gap is changed`)

  test(`[gap] [clip]--> [gap]: next gap duration is reduced`)

  test(`[gap] [clip]--> [gap]: gap is zero when clip is resized to next clip start`)

  test(`[gap] [clip]<--: clip duration reduces; no gap is changed`)

  test(`[gap] [clip]<-- [gap]: next gap duration is increased`)
})

describe(`dragging clips`, () => {
  test('[clip]-->: leading gap is extended')

  test('[clip]--> [clip]: following gap is reduced')

  test('[gap] [clip]-->: leading gap is extended')

  test('[gap] [clip]--> [clip]: leading gap is extended')

  describe(`[gap] [clip] <--[clip]`, () => {
    test('clip and gap have the same duration: gap is deleted ([clip*] [clip])')

    test(`clip now ends at the start of other clip: gap is contracted ([gap] [clip*] [clip])`)

    test(
      `clip now starts after former gap start and ends before former gap end: leading gap is created, gap is contracted ([gap] [clip*] [gap] [clip])`,
    )

    test(`clip now starts at former gap start: gap is contracted ([clip*] [gap] [clip])`)
  })

  test('[clip] [gap] <--[clip]: prev gap is contracted')

  test('[clip] [gap] <--[clip]: prev gap is deleted at zero duration')
})

describe(`deleting clips`, () => {
  test('[clip] [clip*]: no gap is changed')

  test('[clip*] [gap] [clip]: next gap is extended')

  test('[clip] [gap] [clip*]: no gaps remaining')

  test('[clip] [gap] [clip*] [clip]: prev gap is extended')

  test('[clip] [clip*] [gap] [clip]: next gap is extended')

  test('[clip] [gap] [clip*] [gap] [clip]: single gap remains between prev and next clip')
})
