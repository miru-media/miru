/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unsafe-call -- missing types */
// @ts-nocheck
import type { UserConfig } from '@11ty/eleventy'
import { DateTime } from 'luxon'

export default function (eleventyConfig: UserConfig): void {
  eleventyConfig.addFilter('json', (value) => JSON.stringify(value, null, 2))

  eleventyConfig.addFilter('htmlDateString', (dateObj: Date) =>
    // dateObj input: https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#valid-date-string
    DateTime.fromJSDate(dateObj, { zone: 'utc' }).toFormat('yyyy-LL-dd'),
  )
}
