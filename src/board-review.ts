import type { TwinDesignChange, TwinRevision } from './domain'
import { avionicsChange, busDemandKw, proposalPartChanges } from './twin'

export const agentDesign: ReadonlyArray<TwinDesignChange> =
  proposalPartChanges.map(change => ({
    part: change.part,
    before: change.before,
    after: change.after,
    trace: change.trace,
  }))

export const isEngineerDesign = (
  design: ReadonlyArray<TwinDesignChange>,
): boolean =>
  design.length !== agentDesign.length ||
  design.some((row, index) => {
    const agent = agentDesign[index]
    return (
      !agent ||
      row.part !== agent.part ||
      row.before !== agent.before ||
      row.after !== agent.after ||
      row.trace !== agent.trace
    )
  })

const afterOf = (
  design: ReadonlyArray<TwinDesignChange>,
  part: string,
  fallback: string,
): string => design.find(row => row.part === part)?.after ?? fallback

export const designModuleCount = (
  design: ReadonlyArray<TwinDesignChange>,
): number => {
  const count = Number.parseInt(afterOf(design, 'Converter modules', '5'), 10)
  return Number.isFinite(count) ? Math.min(8, Math.max(1, count)) : 5
}

export type DiffState = 'Same' | 'Added' | 'Changed' | 'Removed'

export type SchematicBlock = Readonly<{
  id: string
  ref: string
  label: string
  value: string
  state: DiffState
}>

const baseModules = avionicsChange.modules.A

const moduleBlocks = (count: number): ReadonlyArray<SchematicBlock> =>
  Array.from({ length: Math.max(count, baseModules) }, (_, index) => ({
    id: `PS${index + 1}`,
    ref: `PS${index + 1}`,
    label: 'DC/DC module',
    value: '270→48 V · 3.0 kW',
    state: index >= count ? 'Removed' : index >= baseModules ? 'Added' : 'Same',
  }))

const changedValue = (
  isB: boolean,
  before: string,
  after: string,
): Readonly<{ value: string; state: DiffState }> =>
  isB && after !== before
    ? { value: after, state: 'Changed' }
    : { value: before, state: 'Same' }

export const schematic = (
  revision: TwinRevision,
  design: ReadonlyArray<TwinDesignChange> = agentDesign,
): Readonly<{
  modules: ReadonlyArray<SchematicBlock>
  outputs: ReadonlyArray<SchematicBlock>
}> => {
  const isB = revision === 'B'
  const sspc = changedValue(
    isB,
    '25 A',
    afterOf(design, 'Cockpit feeder SSPC', '25 A'),
  )
  const wire = changedValue(
    isB,
    '10 AWG',
    afterOf(design, 'Cockpit feeder wire', '10 AWG'),
  )
  const hasThirdOutput =
    isB && afterOf(design, '48 V output connectors', '').startsWith('3')
  return {
    modules: moduleBlocks(isB ? designModuleCount(design) : baseModules),
    outputs: [
      { id: 'K3', ref: 'K3', label: 'Cockpit feeder SSPC', ...sspc },
      { id: 'W12', ref: 'W12', label: 'Cockpit feeder', ...wire },
      {
        id: 'J1',
        ref: 'J1–J2',
        label: '48 V outputs',
        value: '2 × MIL-DTL-38999',
        state: 'Same',
      },
      ...(hasThirdOutput
        ? [
            {
              id: 'J3',
              ref: 'J3',
              label: '48 V output',
              value: 'MIL-DTL-38999',
              state: 'Added' as const,
            },
          ]
        : []),
    ],
  }
}

export const schematicDiff = (
  design: ReadonlyArray<TwinDesignChange>,
): ReadonlyArray<
  Readonly<{ part: string; change: string; trace: string; state: DiffState }>
> =>
  design
    .filter(row => row.part.trim() && row.before !== row.after)
    .map(row => ({
      part: row.part,
      change: row.before.trim()
        ? `${row.before} → ${row.after || 'removed'}`
        : `Added: ${row.after}`,
      trace: row.trace,
      state: !row.before.trim()
        ? 'Added'
        : !row.after.trim()
          ? 'Removed'
          : 'Changed',
    }))

/** Synthetic steady-state values for the worst module with one module failed. */
const thermalCase = (revision: TwinRevision) => {
  const modules = avionicsChange.modules[revision] - 1
  const perModuleKw = busDemandKw / modules
  const efficiency = revision === 'A' ? 0.946 : 0.952
  const moduleLossW = perModuleKw * 1000 * (1 / efficiency - 1)
  const fetLossW = (moduleLossW * 0.4) / 8
  return { modules, perModuleKw, efficiency, moduleLossW, fetLossW }
}

export const fetBodyMm = { x: 10, y: 9, z: 4.4 } as const
export const fetBodyVolumeM3 = (fetBodyMm.x * fetBodyMm.y * fetBodyMm.z) / 1e9

export const packageLimitC = 115
export const junctionLimitC = 125
const rThetaJc = 0.45

export type ThermalResult = Readonly<{
  location: string
  a: number
  b: number
  limit: number
}>

export const thermal = (revision: TwinRevision) => {
  const c = thermalCase(revision)
  const coldPlateC = revision === 'A' ? 81 : 76
  const packageC = coldPlateC + c.fetLossW * 4.2
  return {
    ...c,
    volumetricWm3: c.fetLossW / fetBodyVolumeM3,
    appliedW: c.fetLossW * 8,
    coldPlateC,
    packageC,
    pcbC: coldPlateC + c.fetLossW * 2.1,
    junctionEstimateC: packageC + c.fetLossW * rThetaJc,
    coolantOutC: revision === 'A' ? 62 : 63,
  }
}

const round1 = (value: number): number => Math.round(value * 10) / 10

export const thermalResults = (): ReadonlyArray<ThermalResult> => {
  const a = thermal('A')
  const b = thermal('B')
  return [
    {
      location: 'Q3 package top (hottest FET)',
      a: round1(a.packageC),
      b: round1(b.packageC),
      limit: packageLimitC,
    },
    {
      location: 'Q3 junction, estimated from RθJC',
      a: round1(a.junctionEstimateC),
      b: round1(b.junctionEstimateC),
      limit: junctionLimitC,
    },
    {
      location: 'PCB under Q3',
      a: round1(a.pcbC),
      b: round1(b.pcbC),
      limit: 105,
    },
    {
      location: 'Cold plate under worst module',
      a: a.coldPlateC,
      b: b.coldPlateC,
      limit: 95,
    },
    {
      location: 'PAO coolant outlet',
      a: a.coolantOutC,
      b: b.coolantOutC,
      limit: 70,
    },
  ]
}

const fetPositions: ReadonlyArray<readonly [number, number]> = [
  [0.2, 0.3],
  [0.4, 0.3],
  [0.6, 0.3],
  [0.8, 0.3],
  [0.2, 0.7],
  [0.4, 0.7],
  [0.6, 0.7],
  [0.8, 0.7],
]

export const heatScale = { min: 40, max: 125 } as const

/** Temperature field over the module board, normalised 0–1 coordinates. */
export const heatField = (
  revision: TwinRevision,
  columns: number,
  rows: number,
): ReadonlyArray<number> => {
  const t = thermal(revision)
  const rise = t.packageC - t.coldPlateC
  return Array.from({ length: columns * rows }, (_, index) => {
    const x = ((index % columns) + 0.5) / columns
    const y = (Math.floor(index / columns) + 0.5) / rows
    const peak = fetPositions.reduce((best, [fx, fy], fet) => {
      const weight = fet === 2 ? 1 : 0.86
      const d2 = ((x - fx) / 0.09) ** 2 + ((y - fy) / 0.13) ** 2
      return Math.max(best, weight * Math.exp(-d2))
    }, 0)
    return t.coldPlateC - 8 + 8 * (1 - y) * 0.5 + (rise + 8) * peak
  })
}

export const heatColor = (temperature: number): string => {
  const t = Math.min(
    1,
    Math.max(
      0,
      (temperature - heatScale.min) / (heatScale.max - heatScale.min),
    ),
  )
  return `hsl(${Math.round(222 * (1 - t))} 85% 50%)`
}

const fmt = (value: number, digits = 1): string => value.toFixed(digits)

export type ReportSection = Readonly<{
  title: string
  rows: ReadonlyArray<readonly [string, string]>
}>

export const thermalReport = (): ReadonlyArray<ReportSection> => {
  const a = thermal('A')
  const b = thermal('B')
  return [
    {
      title: 'Configuration',
      rows: [
        [
          'Board',
          'MW-CCA-0412 Rev A (baseline) vs Rev B (candidate), DC/DC module power stage',
        ],
        [
          'Components',
          'Q1–Q8 primary-side MOSFETs, D2PAK-7 package; Q3 is the hottest location',
        ],
        [
          'Heated bodies',
          `Q1–Q8 package bodies only, simplified to ${fetBodyMm.x} × ${fetBodyMm.y} × ${fetBodyMm.z} mm blocks`,
        ],
        [
          'Load case',
          `N−1: one module failed, ${busDemandKw.toFixed(1)} kW on the remaining modules (Rev A ${a.modules}, Rev B ${b.modules})`,
        ],
      ],
    },
    {
      title: 'Heat inputs',
      rows: [
        [
          'Module load',
          `Rev A ${fmt(a.perModuleKw, 2)} kW (113% of rating) · Rev B ${fmt(b.perModuleKw, 2)} kW`,
        ],
        [
          'Module loss',
          `P·(1/η − 1): Rev A ${fmt(a.moduleLossW)} W at η ${a.efficiency} · Rev B ${fmt(b.moduleLossW)} W at η ${b.efficiency}`,
        ],
        [
          'MOSFET share',
          'Assumed 40% of module loss, split evenly over 8 FETs (switching + conduction, not from a loss model)',
        ],
        [
          'Per FET',
          `Rev A ${fmt(a.fetLossW, 2)} W · Rev B ${fmt(b.fetLossW, 2)} W`,
        ],
        [
          'Body volume',
          `${fmt(fetBodyVolumeM3 * 1e9, 0)} mm³ (${fetBodyVolumeM3.toExponential(2)} m³) per FET`,
        ],
        [
          'Volumetric rate',
          `Rev A ${a.volumetricWm3.toExponential(2)} W/m³ · Rev B ${b.volumetricWm3.toExponential(2)} W/m³`,
        ],
        [
          'Total applied',
          `Rev A ${fmt(a.appliedW)} W · Rev B ${fmt(b.appliedW)} W per module model`,
        ],
      ],
    },
    {
      title: 'Materials',
      rows: [
        ['Mold compound', 'EMC, k = 0.9 W/m·K (supplier datasheet, assumed)'],
        ['Drain tab', 'Cu C194, k = 260 W/m·K (handbook value)'],
        [
          'PCB',
          '8-layer, 2 oz Cu, equivalent orthotropic block: in-plane 35, through-plane 0.8 W/m·K (rule-of-mixtures approximation)',
        ],
        [
          'Thermal vias',
          'Via field under tab as equivalent block, through-plane k = 30 W/m·K',
        ],
        ['Gap pad', 'k = 3.0 W/m·K, 0.5 mm compressed (supplier datasheet)'],
        ['Cold plate', 'Al 6061-T6, k = 167 W/m·K (handbook value)'],
      ],
    },
    {
      title: 'Thermal paths',
      rows: [
        [
          'Contacts',
          'Bonded: die-block → tab → solder → pad → PCB; gap pad → cold plate',
        ],
        [
          'Conductance',
          'Gap pad to cold plate: 5,000 W/m²·K contact conductance (assumed)',
        ],
        [
          'Solder / pad',
          'SAC305 tab joint as 0.1 mm layer, k derated 58 → 40 W/m·K for 25% voiding',
        ],
        [
          'Missing geometry',
          'Leads, gate drivers, bus bars, magnetics and fasteners omitted; their heat and conduction are not modelled',
        ],
      ],
    },
    {
      title: 'Cooling',
      rows: [
        ['Coolant', 'PAO inlet 55 °C, 4.0 L/min per module'],
        [
          'Cold-plate channels',
          'h = 2,500 W/m²·K on channel walls (Dittus–Boelter hand calculation)',
        ],
        [
          'Air side',
          'Bay air 71 °C, natural convection h = 5 W/m²·K on exposed PCB top surfaces',
        ],
        [
          'Radiation',
          'Neglected (enclosed bay, small temperature differences)',
        ],
      ],
    },
    {
      title: 'Numerical checks',
      rows: [
        [
          'Mesh',
          '1.42 M elements (Rev B module), 0.15 mm in packages, 3 elements through solder',
        ],
        [
          'Convergence',
          'Refining 0.30 → 0.15 mm moved Q3 peak by 0.4 °C (< 1%)',
        ],
        [
          'Solver warnings',
          '0 errors · 1 warning: small initial overlap on contact 14, resolved by pinball adjustment',
        ],
        [
          'Heat balance',
          `Applied ${fmt(b.appliedW)} W · out via cold plate ${fmt(b.appliedW * 0.993)} W, air ${fmt(b.appliedW * 0.006, 2)} W · imbalance 0.1%`,
        ],
      ],
    },
    {
      title: 'Results',
      rows: thermalResults().map(row => [
        row.location,
        `Rev A ${fmt(row.a)} °C · Rev B ${fmt(row.b)} °C · limit ${row.limit} °C · margin ${fmt(row.limit - row.b)} °C`,
      ]),
    },
    {
      title: 'Validity limits',
      rows: [
        [
          'What is shown',
          'Package-top and board temperatures. Junction values are estimates: package + P·RθJC (0.45 °C/W), not solved',
        ],
        [
          'Not covered',
          'The 200 ms 3.5 kW cockpit peak needs a transient run; steady state only',
        ],
        [
          'Correlation',
          'Thermocouples on Q3 / PCB and IR imaging on the EDU during TST-PSU thermal soak; update contact conductance from the result',
        ],
        [
          'Contour scale',
          `Both revisions plotted on the same ${heatScale.min}–${heatScale.max} °C scale`,
        ],
      ],
    },
  ]
}

export type PdrItem = Readonly<{
  part: string
  rationale: string
  risk: 'Low' | 'Medium' | 'High'
  mitigation: string
  trace: string
}>

export const pdr = {
  id: 'PDR-MPA-RevB',
  scope:
    'MW-MPA-48-5 Rev B power board and assembly, raised by ECP-0219 (cockpit avionics 0.9 → 2.7 kW). Covers electrical, thermal and mechanical changes against MW-MPA-48-4 Rev A.',
  entry: [
    [
      'Driving requirements revised and baselined (REQ-AVN-01, REQ-PSU-01…03)',
      true,
    ],
    ['Load budget with one module failed', true],
    ['Schematic delta against Rev A', true],
    ['Preliminary thermal analysis (steady state)', true],
    ['Mass and CG estimate', true],
    ['Transient (200 ms peak) analysis', false],
  ] satisfies ReadonlyArray<readonly [string, boolean]>,
  items: [
    {
      part: 'Converter modules',
      rationale:
        'Restores N−1: 4 × 3.0 kW = 12.0 kW for 10.2 kW demand, +15% margin',
      risk: 'Low',
      mitigation:
        'Same qualified module as PS1–PS4; current sharing re-checked in test',
      trace: 'REQ-PSU-01',
    },
    {
      part: 'Chassis',
      rationale: 'Holds the 5th module; first mode stays above 150 Hz (196 Hz)',
      risk: 'Medium',
      mitigation: 'Random vibration on the EDU before CDR',
      trace: 'REQ-PSU-03',
    },
    {
      part: 'Cold plate',
      rationale:
        'Rejects 0.54 kW within the 0.65 kW allocation; Q3 package 103 °C vs 115 °C limit',
      risk: 'Medium',
      mitigation: 'Correlate the thermal model in TST-PSU thermal soak',
      trace: 'REQ-PSU-02',
    },
    {
      part: 'Cockpit feeder SSPC',
      rationale: 'New steady current 56 A plus 200 ms peak at 73 A',
      risk: 'Low',
      mitigation: 'Trip-curve coordination with the downstream breaker',
      trace: 'REQ-AVN-01',
    },
    {
      part: 'Cockpit feeder wire',
      rationale: 'Voltage drop 1.18 V → 0.46 V against the 0.96 V (2%) limit',
      risk: 'Low',
      mitigation: 'Harness routing and bend radius check with structures',
      trace: 'REQ-AVN-01',
    },
    {
      part: '48 V output connectors',
      rationale: 'Dedicated cockpit feeder output',
      risk: 'Low',
      mitigation: 'ICD update with the cockpit integrator',
      trace: 'INT-PSU',
    },
  ] satisfies ReadonlyArray<PdrItem>,
  actions: [
    [
      'AI-01',
      'Run the transient analysis for the 200 ms 3.5 kW peak',
      'Alex Rivera',
      'Before CDR',
    ],
    [
      'AI-02',
      'Confirm mass 25.5 kg vs 26 kg limit with weighed EDU',
      'Jordan Lee',
      'Before CDR',
    ],
    [
      'AI-03',
      'Update the ICD for J3 with the cockpit integrator',
      'Jordan Lee',
      'Before CDR',
    ],
  ] satisfies ReadonlyArray<readonly [string, string, string, string]>,
  recommendation:
    'Proceed to detailed design. All driving requirements close on analysis; two medium risks are carried with test mitigations and one entry criterion (transient analysis) is open as AI-01.',
  exit: [
    'EE approval of the preliminary design',
    'Action items assigned with due gates',
    'Rev B installed in the digital twin for requirement re-check',
  ],
} as const

export const pdrItems = (
  design: ReadonlyArray<TwinDesignChange>,
): ReadonlyArray<PdrItem & Readonly<{ isEngineer: boolean }>> =>
  design.map((row, index) => {
    const agentRow = agentDesign[index]
    const agentItem = pdr.items[index]
    return agentRow && agentItem && agentRow.part === row.part
      ? {
          ...agentItem,
          part: `${row.part}: ${row.before} → ${row.after}`,
          trace: row.trace,
          isEngineer: agentRow.after !== row.after,
          ...(agentRow.after === row.after
            ? {}
            : {
                rationale: `Engineer changed the agent's ${agentRow.after} to ${row.after}. ${agentItem.rationale}`,
                risk: 'Medium' as const,
                mitigation: 'Re-run analysis for the engineer value before CDR',
              }),
        }
      : {
          part: `${row.part || 'New change'}: ${row.before || '—'} → ${row.after || '—'}`,
          rationale:
            'Engineer-entered change; not covered by the agent analysis',
          risk: 'Medium' as const,
          mitigation: 'Analyse and trace before CDR',
          trace: row.trace,
          isEngineer: true,
        }
  })
