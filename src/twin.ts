import type {
  Requirement,
  TwinProposal,
  TwinReviewItem,
  TwinRevision,
  TwinSlot,
} from './domain'
import { artifactPortion, portionText, systemHigh } from './marking'

export type TwinArtifact = Readonly<{
  id: string
  title: string
  kind: Requirement['kind']
  owner: string
  subsystem: string
  verification: 'Test' | 'Analysis' | 'Inspection' | 'Demonstration'
  links: ReadonlyArray<string>
  revA: string
  revB: string
  statusB: Requirement['status']
  derivedFrom?: string
}>

export const twinArtifacts: ReadonlyArray<TwinArtifact> = [
  {
    id: 'SYS-EPS',
    title: 'Aft electrical power system',
    kind: 'System',
    owner: 'Dakota Edwards',
    subsystem: 'Electrical power',
    verification: 'Analysis',
    links: ['REQ-PSU-01', 'REQ-PSU-02', 'REQ-PSU-03', 'REQ-AVN-01'],
    revA: 'Two independent 270 VDC aircraft feeds supply a modular power assembly (MPA) that converts to a 48 VDC avionics bus through hot-swappable converter modules run N+1.',
    revB: 'Two independent 270 VDC aircraft feeds supply a modular power assembly (MPA) that converts to a 48 VDC avionics bus through hot-swappable converter modules run N+1.',
    statusB: 'Verified',
  },
  {
    id: 'REQ-AVN-01',
    title: 'Cockpit avionics load interface',
    kind: 'Requirement',
    owner: 'Sarah Chen',
    subsystem: 'Avionics',
    verification: 'Test',
    links: ['REQ-PSU-01', 'REQ-PSU-02'],
    revA: 'The cockpit display processor shall draw no more than 0.9 kW steady from the 48 VDC bus and operate from 42 to 56 VDC.',
    revB: 'The upgraded cockpit display and mission processor shall draw no more than 2.7 kW steady and 3.5 kW for 200 ms from the 48 VDC bus, operate from 42 to 56 VDC, and see no more than 2% feeder voltage drop.',
    statusB: 'Needs review',
  },
  {
    id: 'REQ-PSU-01',
    title: 'MPA 48 V bus capacity',
    kind: 'Requirement',
    owner: 'Sarah Chen',
    subsystem: 'Electrical power',
    verification: 'Test',
    links: ['DES-PSU', 'TST-PSU'],
    revA: 'The MPA shall supply 9.0 kW continuous on the 48 VDC avionics bus with any one converter module failed (N−1).',
    revB: 'The MPA shall supply 12.0 kW continuous on the 48 VDC avionics bus with any one converter module failed (N−1), to carry the cockpit avionics upgrade.',
    statusB: 'Needs review',
  },
  {
    id: 'REQ-PSU-02',
    title: 'MPA heat rejection',
    kind: 'Requirement',
    owner: 'Alex Rivera',
    subsystem: 'Thermal management',
    verification: 'Analysis',
    links: ['INT-PSU', 'SYS-TMS', 'TST-PSU'],
    revA: 'MPA waste heat shall not exceed 0.50 kW rejected to the aft PAO cold plate at an inlet temperature of 55 °C or less.',
    revB: 'MPA waste heat shall not exceed 0.65 kW rejected to the aft PAO cold plate at an inlet temperature of 55 °C or less. The thermal management system shall reserve 0.15 kW of additional aft-bay loop capacity.',
    statusB: 'Needs review',
  },
  {
    id: 'REQ-PSU-03',
    title: 'MPA mass, envelope & mounting',
    kind: 'Requirement',
    owner: 'Jordan Lee',
    subsystem: 'Structures',
    verification: 'Inspection',
    links: ['DES-PSU'],
    revA: 'MPA installed mass shall not exceed 22 kg within aft bay envelope AB-3. Aircraft CG shift shall not exceed 10 mm.',
    revB: 'MPA installed mass shall not exceed 26 kg within aft bay envelope AB-3. Aircraft CG shift shall not exceed 12 mm aft. The chassis shall keep the first natural frequency at or above 150 Hz.',
    statusB: 'Needs review',
  },
  {
    id: 'DES-PSU',
    title: 'Aft modular power assembly',
    kind: 'Design',
    owner: 'Sarah Chen',
    subsystem: 'Electrical power',
    verification: 'Inspection',
    links: ['INT-PSU'],
    revA: 'Rev A · 4 × 3.0 kW 270→48 V converter modules (N+1), 4-slot chassis, single cold plate, 25 A SSPC on the cockpit feeder.',
    revB: 'Rev B · 5 × 3.0 kW 270→48 V converter modules (N+1), 5-slot chassis, extended dual cold plate, 75 A SSPC and 8 AWG cockpit feeder.',
    statusB: 'Needs review',
  },
  {
    id: 'INT-PSU',
    title: 'MPA coolant & bus interface',
    kind: 'Interface',
    owner: 'Jordan Lee',
    subsystem: 'Thermal management',
    verification: 'Inspection',
    links: [],
    revA: 'Coolant: 0.25 kg/s PAO. Electrical: 2 × 270 VDC feeds in; 48 VDC out through 2 × MIL-DTL-38999 connectors.',
    revB: 'Coolant: 0.30 kg/s PAO. Electrical: 2 × 270 VDC feeds in; 48 VDC out through 3 × MIL-DTL-38999 connectors, adding a dedicated cockpit avionics feeder.',
    statusB: 'Needs review',
  },
  {
    id: 'SYS-TMS',
    title: 'Thermal management system',
    kind: 'System',
    owner: 'Alex Rivera',
    subsystem: 'Thermal management',
    verification: 'Analysis',
    links: ['INT-PSU'],
    revA: 'Rejects avionics and power heat loads through the PAO loop. Aft-bay power allocation: 0.55 kW.',
    revB: 'Rejects avionics and power heat loads through the PAO loop. Aft-bay power allocation: 0.70 kW (+0.15 kW for MPA Rev B).',
    statusB: 'Needs review',
  },
  {
    id: 'TST-PSU',
    title: 'MPA thermal, vibration & N−1 qualification',
    kind: 'Test',
    owner: 'Jordan Lee',
    subsystem: 'Verification',
    verification: 'Test',
    links: [],
    revA: 'Thermal soak, random vibration, and module-failure transfer tests. Evidence on file for Rev A.',
    revB: 'Re-qualify Rev B: thermal soak at 12 kW, random vibration with the 5-slot chassis, and a module-failure (N−1) transfer test at 10.2 kW. Evidence pending.',
    statusB: 'Draft',
  },
]

export const derivedArtifacts: ReadonlyArray<TwinArtifact> = [
  {
    id: 'DRV-PSU-01',
    title: 'Converter module current sharing',
    kind: 'Requirement',
    owner: 'Sarah Chen',
    subsystem: 'Electrical power',
    verification: 'Test',
    links: ['DES-PSU', 'TST-PSU'],
    revA: '',
    revB: 'With five converter modules in parallel, each module shall carry within ±10% of the mean module current at bus loads above 20% of rated output.',
    statusB: 'Needs review',
    derivedFrom: 'Converter modules 4 → 5',
  },
  {
    id: 'DRV-PSU-02',
    title: 'Cockpit feeder SSPC trip coordination',
    kind: 'Requirement',
    owner: 'Sarah Chen',
    subsystem: 'Electrical power',
    verification: 'Test',
    links: ['DES-PSU', 'TST-PSU'],
    revA: '',
    revB: 'The 75 A cockpit feeder SSPC shall not trip on a 3.5 kW, 200 ms avionics load step and shall clear a bolted feeder fault within 10 ms.',
    statusB: 'Needs review',
    derivedFrom: 'Cockpit feeder SSPC 25 A → 75 A',
  },
]

const allTwinArtifacts = twinArtifacts.concat(derivedArtifacts)

const derivedIds = new Set(derivedArtifacts.map(item => item.id))

export const isDerivedArtifact = (id: string): boolean => derivedIds.has(id)

export const presentDerived = (
  requirements: ReadonlyArray<Requirement>,
): ReadonlyArray<TwinArtifact> =>
  derivedArtifacts.filter(artifact =>
    requirements.some(item => item.id === artifact.id),
  )

const twinIds = new Set(allTwinArtifacts.map(item => item.id))

export const isTwinArtifact = (id: string): boolean => twinIds.has(id)

export const hasTwinScenario = (
  requirements: ReadonlyArray<Requirement>,
): boolean => requirements.some(item => item.id === 'DES-PSU')

export const twinRevision = (
  requirements: ReadonlyArray<Requirement>,
): TwinRevision =>
  requirements
    .find(item => item.id === 'DES-PSU')
    ?.description.startsWith('Rev B')
    ? 'B'
    : 'A'

const textFor = (artifact: TwinArtifact, revision: TwinRevision): string =>
  revision === 'A' ? artifact.revA : artifact.revB

export const seedTwinArtifacts = (): ReadonlyArray<Requirement> =>
  twinArtifacts.map(artifact => ({
    id: artifact.id,
    title: artifact.title,
    description: artifact.revA,
    kind: artifact.kind,
    status: 'Verified',
    owner: artifact.owner,
    links: artifact.links,
    revision: 1,
  }))

export const installTwinRevision = (
  requirements: ReadonlyArray<Requirement>,
  revision: TwinRevision,
): ReadonlyArray<Requirement> => {
  const updated = requirements.flatMap(item => {
    if (revision === 'A' && derivedIds.has(item.id)) {
      return []
    }
    const artifact = twinArtifacts.find(candidate => candidate.id === item.id)
    if (!artifact || item.description === textFor(artifact, revision)) {
      return [item]
    }
    return [
      {
        ...item,
        description: textFor(artifact, revision),
        status: revision === 'A' ? 'Verified' : artifact.statusB,
        revision: item.revision + 1,
      },
    ]
  })
  if (revision === 'A') {
    return updated
  }
  return updated.concat(
    derivedArtifacts
      .filter(artifact => !updated.some(item => item.id === artifact.id))
      .map(artifact => ({
        id: artifact.id,
        title: artifact.title,
        description: artifact.revB,
        kind: artifact.kind,
        status: artifact.statusB,
        owner: artifact.owner,
        links: artifact.links,
        revision: 1,
      })),
  )
}

export type TwinChange = Readonly<{
  artifact: TwinArtifact
  before: string
  after: string
  status: Requirement['status']
  revision: number
}>

export const twinChanges = (
  requirements: ReadonlyArray<Requirement>,
): ReadonlyArray<TwinChange> =>
  allTwinArtifacts.flatMap(artifact => {
    const current = requirements.find(item => item.id === artifact.id)
    return current && current.description !== artifact.revA
      ? [
          {
            artifact,
            before: artifact.revA,
            after: current.description,
            status: current.status,
            revision: current.revision,
          },
        ]
      : []
  })

export const affectedSubsystems = (
  changes: ReadonlyArray<TwinChange>,
): ReadonlyArray<Readonly<{ name: string; ids: ReadonlyArray<string> }>> => {
  const names = [...new Set(changes.map(change => change.artifact.subsystem))]
  return names.map(name => ({
    name,
    ids: changes
      .filter(change => change.artifact.subsystem === name)
      .map(change => change.artifact.id),
  }))
}

export type AnalysisRow = Readonly<{
  metric: string
  unit: string
  domain: 'Thermal' | 'Mechanical' | 'Electrical'
  revA: number
  revB: number
  limit: Readonly<{ kind: 'Max' | 'Min'; value: number }>
}>

/** Precomputed values, not solver output. */
export const analysisRows: ReadonlyArray<AnalysisRow> = [
  {
    metric: 'N−1 bus capacity',
    unit: 'kW',
    domain: 'Electrical',
    revA: 9,
    revB: 12,
    limit: { kind: 'Min', value: 10.2 },
  },
  {
    metric: 'Converter efficiency',
    unit: '%',
    domain: 'Electrical',
    revA: 95,
    revB: 95.2,
    limit: { kind: 'Min', value: 92 },
  },
  {
    metric: 'Cockpit feeder voltage drop',
    unit: 'V',
    domain: 'Electrical',
    revA: 1.18,
    revB: 0.46,
    limit: { kind: 'Max', value: 0.96 },
  },
  {
    metric: 'Waste heat to PAO loop',
    unit: 'kW',
    domain: 'Thermal',
    revA: 0.54,
    revB: 0.52,
    limit: { kind: 'Max', value: 0.65 },
  },
  {
    metric: 'Peak cold-plate temperature',
    unit: '°C',
    domain: 'Thermal',
    revA: 81,
    revB: 76,
    limit: { kind: 'Max', value: 95 },
  },
  {
    metric: 'Coolant outlet temperature',
    unit: '°C',
    domain: 'Thermal',
    revA: 62,
    revB: 63,
    limit: { kind: 'Max', value: 70 },
  },
  {
    metric: 'Installed mass',
    unit: 'kg',
    domain: 'Mechanical',
    revA: 21,
    revB: 25.5,
    limit: { kind: 'Max', value: 26 },
  },
  {
    metric: 'CG shift (aft)',
    unit: 'mm',
    domain: 'Mechanical',
    revA: 6,
    revB: 9,
    limit: { kind: 'Max', value: 12 },
  },
  {
    metric: 'First natural frequency',
    unit: 'Hz',
    domain: 'Mechanical',
    revA: 230,
    revB: 196,
    limit: { kind: 'Min', value: 150 },
  },
  {
    metric: 'Mount bolt margin of safety',
    unit: '',
    domain: 'Mechanical',
    revA: 0.48,
    revB: 0.31,
    limit: { kind: 'Min', value: 0 },
  },
]

/** Notional change driver on a synthetic 48 VDC bus. */
export const avionicsChange = {
  id: 'ECP-0219',
  title: 'Cockpit avionics upgrade',
  summary:
    'An upgraded cockpit display and mission processor replaces a 0.9 kW unit on the 48 VDC avionics bus. Steady demand rises 1.8 kW, transients grow, and the power assembly rejects more heat.',
  existingLoadKw: 8.4,
  replacedKw: 0.9,
  steadyKw: 2.7,
  peakKw: 3.5,
  peakDurationMs: 200,
  moduleRatingKw: 3,
  modules: { A: 4, B: 5 },
  shortTermRating: 1.25,
  requiredMargin: 0.1,
  efficiency: 0.95,
  heatAllocationKw: { A: 0.5, B: 0.65 },
  busVolts: 48,
  feederOhms: { A: 0.021, B: 0.0082 },
  maxDropFraction: 0.02,
  loadSheet: [
    ['Steady-state power', '2.7 kW (was 0.9 kW)'],
    ['Peak power', '3.5 kW for 200 ms at mode change'],
    ['Startup', '4× inrush for 5 ms, soft-start limited'],
    ['Voltage tolerance', '42–56 VDC steady, 36 VDC for 50 ms'],
    ['Criticality', 'Flight-essential displays'],
    ['Duty cycle', 'Continuous in flight'],
    ['Heat rejection', '2.7 kW to the cockpit PAO branch'],
    ['Fault behavior', 'Shed non-essential channels below 42 VDC'],
  ],
} as const

export const busDemandKw =
  avionicsChange.existingLoadKw -
  avionicsChange.replacedKw +
  avionicsChange.steadyKw

export const busPeakKw =
  busDemandKw - avionicsChange.steadyKw + avionicsChange.peakKw

export const capacityKw = (revision: TwinRevision, failed: number): number =>
  (avionicsChange.modules[revision] - failed) * avionicsChange.moduleRatingKw

export type BudgetRow = Readonly<{
  check: string
  traceId: string
  unit: string
  demand: Readonly<Record<TwinRevision, number>>
  capacity: Readonly<Record<TwinRevision, number>>
}>

export const loadBudget = (): ReadonlyArray<BudgetRow> => {
  const change = avionicsChange
  const heat = busDemandKw * (1 / change.efficiency - 1)
  const amps = (change.steadyKw * 1000) / change.busVolts
  const maxDrop = change.busVolts * change.maxDropFraction
  return [
    {
      check: 'Bus load, all modules',
      traceId: 'REQ-PSU-01',
      unit: 'kW',
      demand: { A: busDemandKw, B: busDemandKw },
      capacity: { A: capacityKw('A', 0), B: capacityKw('B', 0) },
    },
    {
      check: 'Bus load, one module failed (N−1)',
      traceId: 'REQ-PSU-01',
      unit: 'kW',
      demand: { A: busDemandKw, B: busDemandKw },
      capacity: { A: capacityKw('A', 1), B: capacityKw('B', 1) },
    },
    {
      check: `${change.peakDurationMs} ms peak, N−1`,
      traceId: 'REQ-AVN-01',
      unit: 'kW',
      demand: { A: busPeakKw, B: busPeakKw },
      capacity: {
        A: capacityKw('A', 1) * change.shortTermRating,
        B: capacityKw('B', 1) * change.shortTermRating,
      },
    },
    {
      check: 'Converter waste heat',
      traceId: 'REQ-PSU-02',
      unit: 'kW',
      demand: { A: heat, B: heat },
      capacity: change.heatAllocationKw,
    },
    {
      check: 'Cockpit feeder voltage drop',
      traceId: 'REQ-AVN-01',
      unit: 'V',
      demand: { A: amps * change.feederOhms.A, B: amps * change.feederOhms.B },
      capacity: { A: maxDrop, B: maxDrop },
    },
  ]
}

const avionicsArtifact = twinArtifacts.find(item => item.id === 'REQ-AVN-01')

export const isAvionicsUpgraded = (
  requirements: ReadonlyArray<Requirement>,
): boolean => {
  const current = requirements.find(item => item.id === 'REQ-AVN-01')
  return current !== undefined && current.description !== avionicsArtifact?.revA
}

const avionicsDriven = twinArtifacts.filter(item => item.kind === 'Requirement')

export const avionicsRequirementIds = avionicsDriven.map(item => item.id)

export const swapTwinAvionics = (
  requirements: ReadonlyArray<Requirement>,
): ReadonlyArray<Requirement> =>
  requirements.map(item => {
    const artifact = avionicsDriven.find(candidate => candidate.id === item.id)
    return artifact && item.description !== artifact.revB
      ? {
          ...item,
          description: artifact.revB,
          status: artifact.statusB,
          revision: item.revision + 1,
        }
      : item
  })

export const proposalReviewer = {
  name: 'Sarah Chen',
  role: 'Electrical engineer',
} as const

export const proposalPartChanges: ReadonlyArray<
  Readonly<{ part: string; before: string; after: string; trace: string }>
> = [
  {
    part: 'Converter modules',
    before: '4 × 3.0 kW',
    after: '5 × 3.0 kW',
    trace: 'REQ-PSU-01',
  },
  {
    part: 'Chassis',
    before: '4-slot',
    after: '5-slot, stiffened',
    trace: 'REQ-PSU-03',
  },
  {
    part: 'Cold plate',
    before: 'Single',
    after: 'Extended dual',
    trace: 'REQ-PSU-02',
  },
  {
    part: 'Buck MOSFETs Q401–Q404',
    before: 'CSD19532Q5B, 5 × 6 mm SON',
    after: 'CSD19536KTT, D2PAK',
    trace: 'REQ-PSU-02',
  },
  {
    part: 'Cockpit feeder SSPC',
    before: '25 A',
    after: '75 A',
    trace: 'REQ-AVN-01',
  },
  {
    part: 'Cockpit feeder wire',
    before: '10 AWG',
    after: '8 AWG',
    trace: 'REQ-AVN-01',
  },
  {
    part: '48 V output connectors',
    before: '2 × MIL-DTL-38999',
    after: '3 × MIL-DTL-38999',
    trace: 'INT-PSU',
  },
]

const downstreamTests = (
  id: string,
  seen: Set<string> = new Set(),
): ReadonlyArray<string> => {
  if (seen.has(id)) {
    return []
  }
  seen.add(id)
  const artifact = allTwinArtifacts.find(item => item.id === id)
  if (!artifact) {
    return []
  }
  return [
    ...new Set([
      ...(artifact.kind === 'Test' ? [id] : []),
      ...artifact.links.flatMap(link => downstreamTests(link, seen)),
    ]),
  ]
}

export type RequirementCheck = Readonly<{
  id: string
  check: string
  value: string
  limit: string
  isPass: boolean
  verification: TwinArtifact['verification']
  tests: ReadonlyArray<string>
}>

const fixed = (value: number): string => value.toFixed(2)

const checkRow = (
  id: string,
  check: string,
  value: string,
  limit: string,
  isPass: boolean,
): RequirementCheck => ({
  id,
  check,
  value,
  limit,
  isPass,
  verification:
    allTwinArtifacts.find(item => item.id === id)?.verification ?? 'Analysis',
  tests: downstreamTests(id),
})

export const requirementChecks = (
  revision: TwinRevision,
): ReadonlyArray<RequirementCheck> => {
  const budget = loadBudget().map(row =>
    checkRow(
      row.traceId,
      row.check,
      `${fixed(row.demand[revision])} ${row.unit}`,
      `≤ ${fixed(row.capacity[revision])} ${row.unit}`,
      row.demand[revision] <= row.capacity[revision],
    ),
  )
  const mechanical = analysisRows
    .filter(
      row =>
        row.domain === 'Mechanical' &&
        row.metric !== 'Mount bolt margin of safety',
    )
    .map(row => {
      const value = revision === 'A' ? row.revA : row.revB
      return checkRow(
        'REQ-PSU-03',
        row.metric,
        `${value} ${row.unit}`,
        limitLabel(row),
        withinLimit(row, value),
      )
    })
  const rows = budget.concat(mechanical)
  const derived =
    revision === 'B'
      ? [
          checkRow(
            'DRV-PSU-01',
            'Worst module current share',
            '±6.2 %',
            '≤ ±10 %',
            true,
          ),
          checkRow(
            'DRV-PSU-02',
            'SSPC peak on 3.5 kW, 200 ms step',
            '73 A',
            '< 90 A trip',
            true,
          ),
        ]
      : []
  return avionicsRequirementIds
    .flatMap(id => rows.filter(row => row.id === id))
    .concat(derived)
}

export const budgetMargin = (row: BudgetRow, revision: TwinRevision): number =>
  (row.capacity[revision] - row.demand[revision]) / row.capacity[revision]

export const failureCases: ReadonlyArray<
  Readonly<{
    failure: string
    effect: Readonly<Record<TwinRevision, string>>
    isShortA: boolean
  }>
> = [
  {
    failure: 'One converter module fails',
    effect: {
      A: '9.0 kW left for 10.2 kW demand. Non-essential loads shed; displays at risk.',
      B: '12.0 kW left for 10.2 kW demand. No load shed.',
    },
    isShortA: true,
  },
  {
    failure: 'Feed A (270 VDC) lost',
    effect: {
      A: 'Modules cross-fed from feed B. Full capacity retained.',
      B: 'Modules cross-fed from feed B. Full capacity retained.',
    },
    isShortA: false,
  },
  {
    failure: 'Cockpit feeder short circuit',
    effect: {
      A: 'Existing 25 A SSPC is below the new 56 A load; feeder must be resized.',
      B: 'Dedicated 75 A SSPC trips; other 48 V loads unaffected.',
    },
    isShortA: true,
  },
  {
    failure: 'Cold-plate coolant flow lost',
    effect: {
      A: 'Modules derate at 95 °C and shed to essential loads.',
      B: 'Modules derate at 95 °C and shed to essential loads.',
    },
    isShortA: false,
  },
]

export const withinLimit = (row: AnalysisRow, value: number): boolean =>
  row.limit.kind === 'Max' ? value <= row.limit.value : value >= row.limit.value

export const limitLabel = (row: AnalysisRow): string =>
  `${row.limit.kind === 'Max' ? '≤' : '≥'} ${row.limit.value}${row.unit ? ` ${row.unit}` : ''}`

const cell = (value: string): string => value.replaceAll('|', '\\|')
const csv = (value: string): string => `"${value.replaceAll('"', '""')}"`

export const hrdName = (revision: TwinRevision): string =>
  `HRD-PSU-001-Rev${revision}`

export const hrdDocument = (
  requirements: ReadonlyArray<Requirement>,
  date: string,
): string => {
  const revision = twinRevision(requirements)
  const current = (id: string): Requirement | undefined =>
    requirements.find(item => item.id === id)
  const changes = twinChanges(requirements)
  const derived = presentDerived(requirements)
  const rows = twinArtifacts
    .filter(item => item.kind === 'Requirement')
    .concat(derived)
  const line = (artifact: TwinArtifact): string => {
    const item = current(artifact.id)
    return `| ${artifact.id} | ${portionText(artifactPortion(artifact))} ${cell(item?.description ?? artifact.revA)} | ${artifact.verification} | r${item?.revision ?? 1} · ${item?.status ?? 'Verified'} |`
  }
  const declassifyOn = `${Number(date.slice(0, 4)) + 25}${date.slice(5, 7)}${date.slice(8, 10)}`
  return [
    `**${systemHigh}**`,
    '',
    `# Hardware Requirements Document — Aft Modular Power Assembly`,
    '',
    `Document: ${hrdName(revision)} · Date: ${date} · Program: F-35 aft power supply upgrade (demo)`,
    '',
    '```',
    'Classified By: Responsible engineer, Moneywell Gov',
    'Derived From: F-35 Program Security Classification Guide (notional)',
    `Declassify On: ${declassifyOn}`,
    '```',
    '',
    '> (U) Prepared by Stream from the systems model. Not releasable until the sign-offs in section 12 are complete. Classification markings are notional for demonstration.',
    '',
    '## 1. Introduction & scope',
    '',
    '(U) This document specifies the hardware requirements for the aft power supply unit (PSU) and the interfaces it shares with the thermal management and structures subsystems. It covers electrical performance, heat rejection, mass, envelope, mounting, and verification. Software and firmware requirements are out of scope.',
    '',
    changes.length > 0
      ? `This revision (Rev ${revision}) replaces the Rev A unit with a higher-power unit and updates ${changes.length} artifacts in the systems model.`
      : 'This is the baseline (Rev A) issue.',
    '',
    '## 2. Applicable documents',
    '',
    '- MIL-STD-704F — Aircraft electric power characteristics (270 VDC).',
    '- MIL-STD-810H — Environmental engineering considerations and laboratory tests.',
    '- MIL-STD-461G — Control of electromagnetic interference.',
    '- RTCA DO-254 — Design assurance guidance for airborne electronic hardware.',
    '- Program applicability of each standard is to be confirmed by the customer.',
    '',
    '## 3. Product overview',
    '',
    current('SYS-EPS')?.description ?? '',
    '',
    `Configuration item: ${current('DES-PSU')?.description ?? ''}`,
    '',
    '## 4. Requirements',
    '',
    '| ID | Requirement | Verification | Revision · status |',
    '| --- | --- | --- | --- |',
    ...rows.map(line),
    '',
    '## 5. Hardware interfaces',
    '',
    '| ID | Interface | Revision · status |',
    '| --- | --- | --- |',
    ...twinArtifacts
      .filter(item => item.kind === 'Interface')
      .map(
        item =>
          `| ${item.id} | ${portionText(artifactPortion(item))} ${cell(current(item.id)?.description ?? item.revA)} | r${current(item.id)?.revision ?? 1} · ${current(item.id)?.status ?? 'Verified'} |`,
      ),
    '',
    '## 6. Design constraints',
    '',
    `- ${current('REQ-PSU-03')?.description ?? ''}`,
    `- Thermal allocation: ${current('SYS-TMS')?.description ?? ''}`,
    '',
    '## 7. Environmental & compliance requirements',
    '',
    '- Electrical power quality per MIL-STD-704F; EMI per MIL-STD-461G; environmental qualification per MIL-STD-810H, subject to customer tailoring.',
    '',
    '## 8. Verification & validation',
    '',
    '| ID | Method | Evidence |',
    '| --- | --- | --- |',
    ...rows.map(
      item =>
        `| ${item.id} | ${item.verification} | ${item.links.filter(id => id.startsWith('TST-')).join(', ') || 'Analysis report (section 10)'} |`,
    ),
    `| TST-PSU | Test | ${cell(current('TST-PSU')?.description ?? '')} |`,
    '',
    '## 9. Traceability matrix',
    '',
    '| Parent | Requirement | Design / interface | Verification | Subsystem |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map(
      item =>
        `| ${item.derivedFrom ? 'Derived' : 'SYS-EPS'} | ${item.id} | ${item.links.filter(id => !id.startsWith('TST-')).join(', ') || '—'} | ${item.links.filter(id => id.startsWith('TST-')).join(', ') || item.verification} | ${item.subsystem} |`,
    ),
    '',
    derived.length > 0
      ? `(U) Derived requirements: ${derived.map(item => `${item.id} (${item.derivedFrom})`).join('; ')}. They arise from the Rev B design, have no parent system requirement, and are fed back to the system safety assessment.`
      : '(U) No derived requirements.',
    '',
    '## 10. Analysis summary',
    '',
    '| Metric | Rev A | Rev B | Limit | Rev B result |',
    '| --- | --- | --- | --- | --- |',
    ...analysisRows.map(
      row =>
        `| ${row.metric} | ${row.revA} ${row.unit} | ${row.revB} ${row.unit} | ${limitLabel(row)} | ${withinLimit(row, row.revB) ? 'Within limit' : 'Exceeds limit'} |`,
    ),
    '',
    '## 11. Change record',
    '',
    changes.length > 0
      ? '| ID | Subsystem | Before (Rev A) | After |'
      : 'No changes from the baseline.',
    changes.length > 0 ? '| --- | --- | --- | --- |' : '',
    ...changes.map(
      change =>
        `| ${change.artifact.id} | ${change.artifact.subsystem} | ${change.before ? cell(change.before) : 'New · derived'} | ${cell(change.after)} |`,
    ),
    '',
    '## 12. Review & sign-off',
    '',
    '| Role | Name | Signature | Date |',
    '| --- | --- | --- | --- |',
    '| Responsible engineer | | | |',
    '| Thermal analysis | | | |',
    '| Structures | | | |',
    '| Customer | | | |',
    '',
    `**${systemHigh}**`,
    '',
  ].join('\n')
}

export const traceabilityCsv = (
  requirements: ReadonlyArray<Requirement>,
): string =>
  [
    ['ID', 'Title', 'Kind', 'Subsystem', 'Status', 'Revision', 'Links', 'Text'],
    ...twinArtifacts.concat(presentDerived(requirements)).map(artifact => {
      const item = requirements.find(candidate => candidate.id === artifact.id)
      return [
        artifact.id,
        artifact.title,
        artifact.kind,
        artifact.subsystem,
        item?.status ?? '',
        String(item?.revision ?? ''),
        artifact.links.join(' '),
        item?.description ?? '',
      ]
    }),
  ]
    .map(row => row.map(csv).join(','))
    .join('\n')

export const analysisCsv = (): string =>
  [
    [
      'Metric',
      'Domain',
      'Unit',
      'Rev A',
      'Rev B',
      'Limit',
      'Rev B within limit',
      'Source',
    ],
    ...analysisRows.map(row => [
      row.metric,
      row.domain,
      row.unit,
      String(row.revA),
      String(row.revB),
      limitLabel(row),
      withinLimit(row, row.revB) ? 'yes' : 'no',
      'Precomputed',
    ]),
  ]
    .map(row => row.map(csv).join(','))
    .join('\n')

export type PackageFile = Readonly<{ name: string; content: string }>

export const twinPackageFiles = (
  requirements: ReadonlyArray<Requirement>,
  date: string,
): ReadonlyArray<PackageFile> => {
  const name = hrdName(twinRevision(requirements))
  return [
    { name: `${name}.md`, content: hrdDocument(requirements, date) },
    { name: 'traceability.csv', content: traceabilityCsv(requirements) },
    { name: 'analysis.csv', content: analysisCsv() },
    {
      name: 'change-record.json',
      content: JSON.stringify(
        {
          document: name,
          date,
          preparedBy: 'Dakota Edwards',
          changes: twinChanges(requirements).map(change => ({
            id: change.artifact.id,
            subsystem: change.artifact.subsystem,
            before: change.before,
            after: change.after,
            status: change.status,
            revision: change.revision,
          })),
        },
        null,
        2,
      ),
    },
  ]
}

export const twinSignoffs: ReadonlyArray<
  Readonly<{ item: TwinReviewItem; title: string; role: string }>
> = [
  {
    item: 'Requirements',
    title: 'Requirement impact',
    role: 'Systems engineering',
  },
  { item: 'Thermal', title: 'Thermal analysis', role: 'Thermal' },
  { item: 'Mechanical', title: 'Mechanical analysis', role: 'Structures' },
]

const hrdSignoffRole: Readonly<Record<TwinReviewItem, string>> = {
  Requirements: 'Responsible engineer',
  Thermal: 'Thermal analysis',
  Mechanical: 'Structures',
}

export const stampHrdSignoff = (
  content: string,
  item: TwinReviewItem,
  isSigned: boolean,
): string => {
  const start = content.indexOf('## 12. Review & sign-off')
  if (start < 0) {
    return content
  }
  const role = hrdSignoffRole[item]
  const date = /Date: (\d{4}-\d{2}-\d{2})/.exec(content)?.[1] ?? ''
  const row = isSigned
    ? `| ${role} | Dakota Edwards | Signed in Stream | ${date} |`
    : `| ${role} | | | |`
  return (
    content.slice(0, start) +
    content
      .slice(start)
      .split('\n')
      .map(line => (line.startsWith(`| ${role} |`) ? row : line))
      .join('\n')
  )
}

export const signoffTitle = (item: TwinReviewItem): string =>
  twinSignoffs.find(signoff => signoff.item === item)?.title ?? item

export const lowMargin = (row: AnalysisRow): boolean =>
  (row.limit.kind === 'Max'
    ? row.limit.value - row.revB
    : row.revB - row.limit.value) /
    row.limit.value <
  0.1

export type CatalogItem = Readonly<{
  id: string
  revision: string
  slot: TwinSlot
  title: string
  status: 'Released' | 'In work'
  released: string
  value: number
  specs: ReadonlyArray<string>
}>

export const catalogSpecLabels: Readonly<
  Record<TwinSlot, ReadonlyArray<string>>
> = {
  Cockpit: ['Steady power', 'Peak power', 'Heat rejection', 'Bus current'],
  Power: [
    'Converter modules',
    'All-module capacity',
    'N−1 capacity',
    'Heat allocation',
    'Cockpit feeder',
  ],
}

const legacyAvionics: CatalogItem = {
  id: 'MW-AVN-0900',
  revision: 'C',
  slot: 'Cockpit',
  title: 'Cockpit display processor (legacy)',
  status: 'Released',
  released: '2019-04-11',
  value: 0.9,
  specs: ['0.9 kW', '1.1 kW / 200 ms', '0.9 kW', '19 A'],
}

const upgradedAvionics: CatalogItem = {
  id: 'MW-AVN-2700',
  revision: 'A',
  slot: 'Cockpit',
  title: 'Cockpit avionics module',
  status: 'Released',
  released: '2026-09-18',
  value: 2.7,
  specs: ['2.7 kW', '3.5 kW / 200 ms', '2.7 kW', '56 A'],
}

const assemblyRevA: CatalogItem = {
  id: 'MW-MPA-48-4',
  revision: 'A',
  slot: 'Power',
  title: 'Modular power assembly, 4-slot',
  status: 'Released',
  released: '2021-02-03',
  value: 4,
  specs: ['4 × 3.0 kW', '12.0 kW', '9.0 kW', '0.50 kW', '25 A SSPC · 10 AWG'],
}

export const assemblyRevB: CatalogItem = {
  id: 'MW-MPA-48-5',
  revision: 'B',
  slot: 'Power',
  title: 'Modular power assembly, 5-slot',
  status: 'Released',
  released: '2026-09-24',
  value: 5,
  specs: ['5 × 3.0 kW', '15.0 kW', '12.0 kW', '0.65 kW', '75 A SSPC · 8 AWG'],
}

export const twinCatalog: ReadonlyArray<CatalogItem> = [
  legacyAvionics,
  upgradedAvionics,
  assemblyRevA,
  assemblyRevB,
]

export const installedPart = (
  requirements: ReadonlyArray<Requirement>,
  slot: TwinSlot,
): CatalogItem =>
  slot === 'Cockpit'
    ? isAvionicsUpgraded(requirements)
      ? upgradedAvionics
      : legacyAvionics
    : twinRevision(requirements) === 'B'
      ? assemblyRevB
      : assemblyRevA

export const catalogBlocker = (
  requirements: ReadonlyArray<Requirement>,
  item: CatalogItem,
): string | undefined =>
  item.status !== 'Released'
    ? 'Not released in Teamcenter. Only released items can be installed.'
    : item.id === installedPart(requirements, item.slot).id
      ? 'Already installed.'
      : item.id === legacyAvionics.id && twinRevision(requirements) === 'B'
        ? 'Put power assembly Rev A back first.'
        : item.id === assemblyRevB.id && !isAvionicsUpgraded(requirements)
          ? 'Rev A carries the current 8.4 kW load. Swap in the new avionics first.'
          : item.id === assemblyRevB.id
            ? 'Rev B comes from the agent proposal. An electrical engineer approves it on the Digital twin page.'
            : undefined

export type Health = Readonly<{ text: string; tone: 'ok' | 'low' | 'bad' }>

const marginHealth = (available: number, demand: number): Health => {
  const margin = (available - demand) / available
  return {
    text: `N−1 ${available.toFixed(1)} kW for ${demand.toFixed(1)} kW · ${margin >= 0 ? '+' : ''}${(margin * 100).toFixed(1)}% margin`,
    tone: margin < 0 ? 'bad' : 'ok',
  }
}

const demandWith = (cockpitKw: number): number =>
  avionicsChange.existingLoadKw - avionicsChange.replacedKw + cockpitKw

export const catalogImpact = (
  requirements: ReadonlyArray<Requirement>,
  item: CatalogItem,
): Health =>
  item.slot === 'Power'
    ? marginHealth(
        (item.value - 1) * avionicsChange.moduleRatingKw,
        demandWith(installedPart(requirements, 'Cockpit').value),
      )
    : marginHealth(
        (installedPart(requirements, 'Power').value - 1) *
          avionicsChange.moduleRatingKw,
        demandWith(item.value),
      )

export const slotHealth = (
  requirements: ReadonlyArray<Requirement>,
  slot: TwinSlot,
): Health => {
  const power = catalogImpact(
    requirements,
    installedPart(requirements, 'Power'),
  )
  if (slot === 'Power') {
    return power
  }
  const cockpit = installedPart(requirements, 'Cockpit')
  return {
    text: `${cockpit.specs[0] ?? ''} steady · bus ${demandWith(cockpit.value).toFixed(1)} kW`,
    tone: power.tone === 'bad' ? 'low' : 'ok',
  }
}

export const suggestedPart = (
  requirements: ReadonlyArray<Requirement>,
  slot: TwinSlot,
): CatalogItem =>
  twinCatalog.find(
    item =>
      item.slot === slot && catalogBlocker(requirements, item) === undefined,
  ) ?? installedPart(requirements, slot)

export type SyncState = 'In sync' | 'Check-in pending' | 'Awaiting EE approval'

export type SyncFile = Readonly<{
  name: string
  type: string
  teamcenter: string
  stream: string
  state: SyncState
}>

export type SyncGroup = Readonly<{
  id: string
  title: string
  files: ReadonlyArray<SyncFile>
}>

const partFiles = (
  item: CatalogItem,
): ReadonlyArray<Readonly<{ key: string; type: string; name: string }>> => {
  const stem = `${item.id}_${item.revision}`
  return [
    { key: 'prt', type: 'UGMASTER', name: `${stem}.prt` },
    { key: 'jt', type: 'DirectModel', name: `${stem}.jt` },
    {
      key: 'bom',
      type: 'BOMView Revision',
      name: `${item.id}/${item.revision}-view`,
    },
    ...(item.slot === 'Power'
      ? [
          { key: 'ecad', type: 'KiCad Project', name: `${stem}.kicad_pro` },
          { key: 'sch', type: 'PDF', name: `${stem}_schematic.pdf` },
          { key: 'spice', type: 'LTspice Schematic', name: `${stem}_bus.asc` },
          { key: 'cae', type: 'CAE Analysis', name: `${stem}_thermal.wbpz` },
        ]
      : [{ key: 'icd', type: 'PDF', name: `${stem}_ICD.pdf` }]),
  ]
}

export const teamcenterSync = (
  requirements: ReadonlyArray<Requirement>,
  proposal: TwinProposal,
): ReadonlyArray<SyncGroup> => {
  const parts = (['Cockpit', 'Power'] as const).map(slot => {
    const source = installedPart([], slot)
    const local = installedPart(requirements, slot)
    const localFiles = partFiles(local)
    return {
      id: `${local.id}/${local.revision}`,
      title: local.title,
      files: partFiles(source).map(file => {
        const stream =
          localFiles.find(candidate => candidate.key === file.key)?.name ??
          file.name
        return {
          name: stream,
          type: file.type,
          teamcenter: file.name,
          stream,
          state:
            stream === file.name
              ? ('In sync' as const)
              : ('Check-in pending' as const),
        }
      }),
    }
  })
  const proposed =
    proposal === 'Pending' && twinRevision(requirements) === 'A'
      ? [
          {
            id: `${assemblyRevB.id}/${assemblyRevB.revision}`,
            title: `${assemblyRevB.title} · proposed`,
            files: partFiles(assemblyRevB).map(file => ({
              name: file.name,
              type: file.type,
              teamcenter: '—',
              stream: file.name,
              state: 'Awaiting EE approval' as const,
            })),
          },
        ]
      : []
  return [...parts, ...proposed]
}
