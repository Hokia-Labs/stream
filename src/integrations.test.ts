import { describe, expect, it } from 'vitest'

import { doorsSync, jiraHandoffs, ltspiceResults } from './integrations'
import { seedTwinArtifacts, swapTwinAvionics } from './twin'

describe('doorsSync', () => {
  it('flags requirements revised in Stream as pending DOORS change sets', () => {
    expect(
      doorsSync(seedTwinArtifacts()).every(row => row.state === 'In sync'),
    ).toBe(true)
    const pending = doorsSync(swapTwinAvionics(seedTwinArtifacts())).filter(
      row => row.state !== 'In sync',
    )
    expect(pending.length).toBeGreaterThan(0)
    expect(pending.every(row => row.doors === 'A' && row.stream === 'B')).toBe(
      true,
    )
  })
})

describe('jiraHandoffs', () => {
  it('mirrors the EE review gate as a Jira ticket', () => {
    const requirements = swapTwinAvionics(seedTwinArtifacts())
    expect(jiraHandoffs(requirements, 'None')).toEqual([])
    expect(jiraHandoffs(requirements, 'Pending')[0]?.status).toBe('In Review')
    expect(jiraHandoffs(requirements, 'Rejected')[0]?.status).toBe("Won't Do")
    expect(jiraHandoffs(requirements, 'Approved')[0]?.status).toBe('Done')
  })
})

describe('ltspiceResults', () => {
  it('shows Rev A over a limit and Rev B within every limit', () => {
    const results = ltspiceResults()
    expect(results.some(row => row.A > row.limit)).toBe(true)
    expect(results.every(row => row.B <= row.limit)).toBe(true)
  })
})
