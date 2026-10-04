import type { Requirement, TwinReviewItem, TwinRevision } from './domain'
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
}>

export const twinArtifacts: ReadonlyArray<TwinArtifact> = [
  {
    id: 'SYS-EPS',
    title: 'Aft electrical power system',
    kind: 'System',
    owner: 'Ben Juntilla',
    subsystem: 'Electrical power',
    verification: 'Analysis',
    links: ['REQ-PSU-01', 'REQ-PSU-02', 'REQ-PSU-03'],
    revA: 'Supplies conditioned 270 VDC from the aft power supply unit (PSU) to the mission-systems bus.',
    revB: 'Supplies conditioned 270 VDC from the aft power supply unit (PSU) to the mission-systems bus.',
    statusB: 'Verified',
  },
  {
    id: 'REQ-PSU-01',
    title: 'PSU continuous output power',
    kind: 'Requirement',
    owner: 'Sarah Chen',
    subsystem: 'Electrical power',
    verification: 'Test',
    links: ['DES-PSU', 'TST-PSU'],
    revA: 'The aft PSU shall deliver 270 VDC at 30 kW continuous to the mission-systems bus.',
    revB: 'The aft PSU shall deliver 270 VDC at 45 kW continuous to the mission-systems bus to support the upgraded mission-systems load.',
    statusB: 'Needs review',
  },
  {
    id: 'REQ-PSU-02',
    title: 'PSU heat rejection',
    kind: 'Requirement',
    owner: 'Alex Rivera',
    subsystem: 'Thermal management',
    verification: 'Analysis',
    links: ['INT-PSU', 'SYS-TMS', 'TST-PSU'],
    revA: 'PSU waste heat shall not exceed 2.8 kW rejected to the PAO coolant loop at an inlet temperature of 55 °C or less.',
    revB: 'PSU waste heat shall not exceed 3.1 kW rejected to the PAO coolant loop at an inlet temperature of 55 °C or less. The thermal management system shall reserve 0.3 kW of additional aft-bay loop capacity.',
    statusB: 'Needs review',
  },
  {
    id: 'REQ-PSU-03',
    title: 'PSU mass, envelope & mounting',
    kind: 'Requirement',
    owner: 'Jordan Lee',
    subsystem: 'Structures',
    verification: 'Inspection',
    links: ['DES-PSU'],
    revA: 'PSU installed mass shall not exceed 40 kg within aft bay envelope AB-3. Aircraft CG shift shall not exceed 10 mm.',
    revB: 'PSU installed mass shall not exceed 45 kg within aft bay envelope AB-3. Aircraft CG shift shall not exceed 15 mm aft. The mounting structure shall keep the first natural frequency at or above 150 Hz.',
    statusB: 'Needs review',
  },
  {
    id: 'DES-PSU',
    title: 'Aft PSU assembly',
    kind: 'Design',
    owner: 'Sarah Chen',
    subsystem: 'Electrical power',
    verification: 'Inspection',
    links: ['INT-PSU'],
    revA: 'Rev A · 30 kW silicon converter, single cold plate, 4-point mount.',
    revB: 'Rev B · 45 kW silicon-carbide converter, enlarged dual cold plate, 6-point mount.',
    statusB: 'Needs review',
  },
  {
    id: 'INT-PSU',
    title: 'PSU coolant & bus interface',
    kind: 'Interface',
    owner: 'Jordan Lee',
    subsystem: 'Thermal management',
    verification: 'Inspection',
    links: [],
    revA: 'Coolant: 0.9 kg/s PAO. Electrical: 270 VDC through 2 × MIL-DTL-38999 connectors.',
    revB: 'Coolant: 1.1 kg/s PAO. Electrical: 270 VDC through 3 × MIL-DTL-38999 connectors.',
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
    revA: 'Rejects avionics and power heat loads through the PAO loop. Aft-bay allocation: 3.0 kW.',
    revB: 'Rejects avionics and power heat loads through the PAO loop. Aft-bay allocation: 3.3 kW (+0.3 kW for PSU Rev B).',
    statusB: 'Needs review',
  },
  {
    id: 'TST-PSU',
    title: 'PSU thermal & vibration qualification',
    kind: 'Test',
    owner: 'Jordan Lee',
    subsystem: 'Verification',
    verification: 'Test',
    links: [],
    revA: 'Thermal soak and random vibration qualification. Evidence on file for Rev A.',
    revB: 'Re-qualify Rev B: thermal soak at 45 kW and random vibration with the 6-point mount. Evidence pending.',
    statusB: 'Draft',
  },
]

const twinIds = new Set(twinArtifacts.map(item => item.id))

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
): ReadonlyArray<Requirement> =>
  requirements.map(item => {
    const artifact = twinArtifacts.find(candidate => candidate.id === item.id)
    if (!artifact || item.description === textFor(artifact, revision)) {
      return item
    }
    return {
      ...item,
      description: textFor(artifact, revision),
      status: revision === 'A' ? 'Verified' : artifact.statusB,
      revision: item.revision + 1,
    }
  })

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
  twinArtifacts.flatMap(artifact => {
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

/** Precomputed SAMPLE values, not solver output. */
export const analysisRows: ReadonlyArray<AnalysisRow> = [
  {
    metric: 'Continuous output power',
    unit: 'kW',
    domain: 'Electrical',
    revA: 30,
    revB: 45,
    limit: { kind: 'Min', value: 45 },
  },
  {
    metric: 'Converter efficiency',
    unit: '%',
    domain: 'Electrical',
    revA: 92,
    revB: 94,
    limit: { kind: 'Min', value: 90 },
  },
  {
    metric: 'Waste heat to PAO loop',
    unit: 'kW',
    domain: 'Thermal',
    revA: 2.61,
    revB: 2.87,
    limit: { kind: 'Max', value: 3.1 },
  },
  {
    metric: 'Peak cold-plate temperature',
    unit: '°C',
    domain: 'Thermal',
    revA: 78,
    revB: 84,
    limit: { kind: 'Max', value: 95 },
  },
  {
    metric: 'Coolant outlet temperature',
    unit: '°C',
    domain: 'Thermal',
    revA: 61,
    revB: 64,
    limit: { kind: 'Max', value: 70 },
  },
  {
    metric: 'Installed mass',
    unit: 'kg',
    domain: 'Mechanical',
    revA: 38,
    revB: 43,
    limit: { kind: 'Max', value: 45 },
  },
  {
    metric: 'CG shift (aft)',
    unit: 'mm',
    domain: 'Mechanical',
    revA: 6,
    revB: 11,
    limit: { kind: 'Max', value: 15 },
  },
  {
    metric: 'First natural frequency',
    unit: 'Hz',
    domain: 'Mechanical',
    revA: 212,
    revB: 188,
    limit: { kind: 'Min', value: 150 },
  },
  {
    metric: 'Mount bolt margin of safety',
    unit: '',
    domain: 'Mechanical',
    revA: 0.42,
    revB: 0.27,
    limit: { kind: 'Min', value: 0 },
  },
]

/** Notional change driver on a synthetic 270 VDC bus. SAMPLE values. */
export const avionicsChange = {
  id: 'ECP-0219',
  title: 'Cockpit avionics upgrade',
  summary:
    'A new display and mission-processor module joins the 270 VDC mission-systems bus. It raises steady and transient electrical demand and adds heat.',
  existingLoadKw: 26.4,
  steadyKw: 7.8,
  peakKw: 11.5,
  peakDurationMs: 200,
  shortTermRating: 1.25,
  requiredMargin: 0.1,
  efficiency: { A: 0.92, B: 0.94 },
  heatAllocationKw: { A: 2.8, B: 3.1 },
  loadSheet: [
    ['Steady-state power', '7.8 kW'],
    ['Peak power', '11.5 kW for 200 ms at mode change'],
    ['Startup', '4× inrush for 5 ms, soft-start limited'],
    ['Voltage tolerance', '250–280 VDC steady, 200 VDC for 50 ms'],
    ['Criticality', 'Flight-essential displays'],
    ['Duty cycle', 'Continuous in flight'],
    ['Heat rejection', '7.8 kW to the cockpit PAO branch'],
    ['Fault behavior', 'Shed non-essential channels on undervoltage'],
  ],
} as const

export type BudgetRow = Readonly<{
  check: string
  traceId: string
  unit: string
  demand: Readonly<Record<TwinRevision, number>>
  capacity: Readonly<Record<TwinRevision, number>>
}>

export const loadBudget = (): ReadonlyArray<BudgetRow> => {
  const change = avionicsChange
  const steady = change.existingLoadKw + change.steadyKw
  const peak = change.existingLoadKw + change.peakKw
  const rating = { A: 30, B: 45 }
  const heat = (revision: TwinRevision) =>
    steady * (1 / change.efficiency[revision] - 1)
  return [
    {
      check: 'Continuous bus load',
      traceId: 'REQ-PSU-01',
      unit: 'kW',
      demand: { A: steady, B: steady },
      capacity: rating,
    },
    {
      check: `${change.peakDurationMs} ms peak load`,
      traceId: 'REQ-PSU-01',
      unit: 'kW',
      demand: { A: peak, B: peak },
      capacity: {
        A: rating.A * change.shortTermRating,
        B: rating.B * change.shortTermRating,
      },
    },
    {
      check: 'PSU waste heat to PAO loop',
      traceId: 'REQ-PSU-02',
      unit: 'kW',
      demand: { A: heat('A'), B: heat('B') },
      capacity: change.heatAllocationKw,
    },
  ]
}

export const budgetMargin = (row: BudgetRow, revision: TwinRevision): number =>
  (row.capacity[revision] - row.demand[revision]) / row.capacity[revision]

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
  const rows = twinArtifacts.filter(item => item.kind === 'Requirement')
  const line = (artifact: TwinArtifact): string => {
    const item = current(artifact.id)
    return `| ${artifact.id} | ${portionText(artifactPortion(artifact))} ${cell(item?.description ?? artifact.revA)} | ${artifact.verification} | r${item?.revision ?? 1} · ${item?.status ?? 'Verified'} |`
  }
  const declassifyOn = `${Number(date.slice(0, 4)) + 25}${date.slice(5, 7)}${date.slice(8, 10)}`
  return [
    `**${systemHigh}**`,
    '',
    `# Hardware Requirements Document — Aft Power Supply Unit`,
    '',
    `Document: ${hrdName(revision)} · Date: ${date} · Program: F-35 aft power supply upgrade (demo)`,
    '',
    '```',
    'Classified By: Responsible engineer, Moneywell Gov',
    'Derived From: F-35 Program Security Classification Guide (notional)',
    `Declassify On: ${declassifyOn}`,
    '```',
    '',
    '> (U) Prepared by Stream from the systems model. Analysis values are SAMPLE precomputed data, not ANSYS solver output. Not releasable until the sign-offs in section 12 are complete. Classification markings are notional for demonstration.',
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
        `| SYS-EPS | ${item.id} | ${item.links.filter(id => !id.startsWith('TST-')).join(', ') || '—'} | ${item.links.filter(id => id.startsWith('TST-')).join(', ') || item.verification} | ${item.subsystem} |`,
    ),
    '',
    '## 10. Analysis summary (SAMPLE)',
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
        `| ${change.artifact.id} | ${change.artifact.subsystem} | ${cell(change.before)} | ${cell(change.after)} |`,
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
    ...twinArtifacts.map(artifact => {
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
      'SAMPLE precomputed',
    ]),
  ]
    .map(row => row.map(csv).join(','))
    .join('\n')

export type PackageFile = Readonly<{ name: string; content: string }>

export const twinPackageFiles = (
  requirements: ReadonlyArray<Requirement>,
  date: string,
  reviewed: ReadonlyArray<string>,
): ReadonlyArray<PackageFile> => {
  const name = hrdName(twinRevision(requirements))
  return [
    { name: `${name}.md`, content: hrdDocument(requirements, date) },
    { name: 'traceability.csv', content: traceabilityCsv(requirements) },
    { name: 'analysis-SAMPLE.csv', content: analysisCsv() },
    {
      name: 'change-record.json',
      content: JSON.stringify(
        {
          document: name,
          date,
          reviewedBy: 'Ben Juntilla',
          reviewed,
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

export const signoffTitle = (item: TwinReviewItem): string =>
  twinSignoffs.find(signoff => signoff.item === item)?.title ?? item

export const lowMargin = (row: AnalysisRow): boolean =>
  (row.limit.kind === 'Max'
    ? row.limit.value - row.revB
    : row.revB - row.limit.value) /
    row.limit.value <
  0.1
