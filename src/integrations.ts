import type { Requirement, TwinProposal } from './domain'
import {
  isDerivedArtifact,
  loadBudget,
  proposalReviewer,
  twinArtifacts,
  twinRevision,
} from './twin'

export const doorsModule = {
  id: 'EPS-SRS',
  title: 'EPS system requirements',
  baseline: 'BL-07',
} as const

export type DoorsRow = Readonly<{
  id: string
  doorsId: string
  title: string
  type: string
  doors: string
  stream: string
  state: 'In sync' | 'Change set pending'
}>

const doorsTypes: Partial<Record<Requirement['kind'], string>> = {
  Requirement: 'System Requirement',
  System: 'System Description',
  Function: 'Functional Requirement',
  Interface: 'Interface Requirement',
}

const revisionLetter = (revision: number): string =>
  String.fromCodePoint(64 + Math.max(1, revision))

export const doorsId = (id: string): string => {
  let hash = 0
  for (const char of id) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 90_000
  }
  return String(10_000 + hash)
}

export const doorsIdFor = (item: Requirement): string | undefined =>
  doorsTypes[item.kind] === undefined ? undefined : doorsId(item.id)

export const doorsSync = (
  requirements: ReadonlyArray<Requirement>,
): ReadonlyArray<DoorsRow> =>
  requirements.flatMap(item => {
    const type = doorsTypes[item.kind]
    if (type === undefined) {
      return []
    }
    const stream = revisionLetter(item.revision)
    const doors = isDerivedArtifact(item.id)
      ? '—'
      : twinArtifacts.some(artifact => artifact.id === item.id)
        ? 'A'
        : stream
    return [
      {
        id: item.id,
        doorsId: doorsId(item.id),
        title: item.title,
        type,
        doors,
        stream,
        state: doors === stream ? 'In sync' : 'Change set pending',
      },
    ]
  })

export type JiraStatus = 'In Review' | 'Done' | "Won't Do"

export type JiraTicket = Readonly<{
  key: string
  summary: string
  assignee: string
  reporter: string
  status: JiraStatus
}>

const handoffStatus = (
  requirements: ReadonlyArray<Requirement>,
  proposal: TwinProposal,
): JiraStatus | undefined =>
  twinRevision(requirements) === 'B' || proposal === 'Approved'
    ? 'Done'
    : proposal === 'Pending'
      ? 'In Review'
      : proposal === 'Rejected'
        ? "Won't Do"
        : undefined

export const jiraHandoffs = (
  requirements: ReadonlyArray<Requirement>,
  proposal: TwinProposal,
): ReadonlyArray<JiraTicket> => {
  const status = handoffStatus(requirements, proposal)
  return status === undefined
    ? []
    : [
        {
          key: 'EPS-142',
          summary: 'EE review: power board Rev A → Rev B',
          assignee: proposalReviewer.name,
          reporter: 'Stream · Power agent',
          status,
        },
      ]
}

export type SpiceResult = Readonly<{
  measure: string
  meas: string
  traceId: string
  unit: string
  A: number
  B: number
  limit: number
}>

export const ltspiceResults = (): ReadonlyArray<SpiceResult> => {
  const feeder = loadBudget().find(
    row => row.check === 'Cockpit feeder voltage drop',
  )
  return [
    ...(feeder === undefined
      ? []
      : [
          {
            measure: 'Feeder drop, steady load',
            meas: 'vdrop_feeder',
            traceId: feeder.traceId,
            unit: 'V',
            A: feeder.demand.A,
            B: feeder.demand.B,
            limit: feeder.capacity.B,
          },
        ]),
    {
      measure: 'Bus droop, 200 ms peak, N−1',
      meas: 'vdroop_peak',
      traceId: 'REQ-AVN-01',
      unit: 'V',
      A: 7.4,
      B: 3.1,
      limit: 6,
    },
    {
      measure: 'Bus ripple, peak to peak',
      meas: 'vripple_pp',
      traceId: 'REQ-PSU-01',
      unit: 'V',
      A: 0.62,
      B: 0.48,
      limit: 1,
    },
  ]
}
