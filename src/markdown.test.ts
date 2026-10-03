import { describe, expect, it } from 'vitest'

import {
  isLongFinding,
  markdownBlocks,
  markdownPreview,
  markdownToPlainText,
  summarizeFinding,
} from './markdown'

describe('finding previews', () => {
  it('strips markdown syntax to plain text', () => {
    expect(
      markdownToPlainText(
        '## Impact\n- **REQ-002** changes [mass](https://x.test)\n- `DES-001` needs review',
      ),
    ).toBe('Impact REQ-002 changes mass DES-001 needs review')
  })

  it('truncates long findings on a word boundary', () => {
    const preview = markdownPreview('word '.repeat(100), 40)
    expect(preview.endsWith('…')).toBe(true)
    expect(preview.length).toBeLessThanOrEqual(41)
    expect(preview).not.toContain('wor…')
  })

  it('flags multi-line or long findings as expandable', () => {
    expect(isLongFinding('Short and done.')).toBe(false)
    expect(isLongFinding('# Title\nBody')).toBe(true)
    expect(isLongFinding('a '.repeat(200))).toBe(true)
  })
})

describe('finding summaries', () => {
  it('uses a specific heading as the title and counts findings', () => {
    const summary = summarizeFinding(
      '## Thermal margin below limit\n\nPSU Rev B runs **4 C** hotter than Rev A under load.\n\n## Findings\n\n1. One\n2. Two\n\n| a | b |\n|---|---|\n| 1 | 2 |',
    )
    expect(summary.title).toBe('Thermal margin below limit')
    expect(summary.preview).toBe(
      'PSU Rev B runs 4 C hotter than Rev A under load.',
    )
    expect(summary.findings).toBe(2)
    expect(summary.tables).toBe(1)
  })

  it('skips generic headings and reads an explicit severity', () => {
    const summary = summarizeFinding(
      'Severity: high\n\n## Summary\n\nConnector J4 is overloaded. Derate it before release.',
    )
    expect(summary.severity).toBe('Error')
    expect(summary.title).toBe('Connector J4 is overloaded.')
    expect(summary.preview).toBe('Derate it before release.')
  })

  it('treats failed tasks as errors', () => {
    expect(summarizeFinding('Timed out.', 'Failed').severity).toBe('Error')
  })

  it('splits log lines by markdown block', () => {
    expect(
      markdownBlocks(
        '## Findings\n\n1. **DES-001** lacks margin.\n2. Second\n\n```\na\nb\n```',
      ),
    ).toEqual([
      '§ Findings',
      'DES-001 lacks margin.',
      'Second',
      'code (2 lines)',
    ])
  })
})
