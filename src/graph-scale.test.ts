import { describe, expect, it } from 'vitest'

import { seedWorkspace } from './domain'
import {
  cardLayout,
  cardLimit,
  focusItems,
  graphIndex,
  matrixRows,
  overviewLayout,
  stressRequirements,
} from './graph-scale'

describe('scalable systems graph', () => {
  const items = stressRequirements(2000)
  const index = graphIndex(items)

  it('keeps a focused trace small in a 2,000-artifact workspace', () => {
    const selected = items[400]?.id ?? ''
    const focused = focusItems(items, index, selected, '2 hops', [])
    expect(focused.map(item => item.id)).toContain(selected)
    expect(focused.length).toBeLessThan(cardLimit)
    expect(focusItems(items, index, '', '2 hops', [])).toHaveLength(2000)
  })

  it('lays out 2,000 artifacts into system clusters quickly', () => {
    const start = performance.now()
    const layout = overviewLayout(items, index, 966)
    const elapsed = performance.now() - start
    expect(layout.clusters).toHaveLength(8)
    expect(
      layout.clusters.reduce((sum, cluster) => sum + cluster.members.length, 0),
    ).toBe(2000)
    expect(elapsed).toBeLessThan(500)
  })

  it('hides filtered kinds but keeps the selected artifact', () => {
    const selected = items.find(item => item.kind === 'Test')?.id ?? ''
    const focused = focusItems(items, index, selected, 'All', ['Test'])
    expect(
      focused.filter(item => item.kind === 'Test').map(item => item.id),
    ).toEqual([selected])
  })

  it('places the seed workspace like before and flags untested requirements', () => {
    const seed = seedWorkspace.requirements
    const seedIndex = graphIndex(seed)
    expect(cardLayout(seed, seedIndex, 3)).toHaveLength(seed.length)
    const rows = matrixRows(items, index)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.some(row => row.hasGap)).toBe(true)
  })
})
