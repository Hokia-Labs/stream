import { describe, expect, it } from 'vitest'

import { decodeEntities } from './markdown-view'

describe('decodeEntities', () => {
  it('decodes named and numeric entities without touching unknown ones', () => {
    expect(decodeEntities('&lt;b&gt; &amp; &#39;x&#x27; &bogus;')).toBe(
      "<b> & 'x' &bogus;",
    )
  })
})
