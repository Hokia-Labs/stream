import { Option, Schema } from 'effect'
import { CustomElement } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import {
  type DiffState,
  isEngineerDesign,
  pdr,
  pdrItems,
  schematicBoards,
  schematicDiff,
  thermalReport,
  thermalResults,
} from './board-review'
import {
  BoardReviewTab,
  type Requirement,
  type TwinDesignField,
  TwinFocus,
  TwinPanelTab,
  type TwinReviewItem,
  TwinRevision,
  type TwinSlot,
} from './domain'
import { idLink, linkifyIds } from './id-link'
import {
  ansysLogo,
  jiraChip,
  kicadLogo,
  ltspiceLogo,
  toolHead,
} from './integration-view'
import { jiraHandoffs, ltspiceResults } from './integrations'
import type { Model } from './main'
import { Message } from './message'
import { pageHeading } from './title-block'
import {
  type TwinChange,
  affectedSubsystems,
  analysisRows,
  assemblyRevB,
  avionicsChange,
  avionicsRequirementIds,
  busDemandKw,
  capacityKw,
  catalogBlocker,
  catalogImpact,
  catalogSpecLabels,
  derivedArtifacts,
  hasTwinScenario,
  installedPart,
  isAvionicsUpgraded,
  lowMargin,
  proposalReviewer,
  requirementChecks,
  requirementsChangeLabel,
  signoffTitle,
  slotHealth,
  twinArtifacts,
  twinCatalog,
  twinChanges,
  twinRevision,
  twinSignoffs,
  withinLimit,
} from './twin'

type H = HtmlBuilder<Message>

const twinSpec = CustomElement.define({
  tag: 'stream-twin',
  properties: {
    twinFocus: TwinFocus,
    twinRevision: TwinRevision,
    twinAvionicsUpgraded: Schema.Boolean,
  },
  events: {
    'twin-pick': Schema.Struct({ part: Schema.String }),
  },
})

const boardSpec = CustomElement.define({
  tag: 'stream-board',
  properties: {},
  events: {},
})

const reportEditorSpec = CustomElement.define({
  tag: 'stream-report-editor',
  properties: {
    reportName: Schema.String,
    markdown: Schema.String,
  },
  events: {
    'report-input': Schema.Struct({
      name: Schema.String,
      markdown: Schema.String,
    }),
  },
})

const reportLabel = (name: string): string =>
  name.replace(/-PSU-001-Rev[AB]\.md$/, '')

const syncLabel: Readonly<Record<Model['twinReportSync'], string>> = {
  Local: '',
  Saving: 'Saving…',
  Saved: 'Saved',
  Failed: 'Not saved',
}

const expandPath = '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'

const reportEditor = (
  model: Model,
  actions: ReadonlyArray<Html>,
  h: H,
  isExpanded = false,
): Html => {
  const isElsewhere = !isExpanded && model.modal._tag === 'ReportEditor'
  const editor = reportEditorSpec.withMessage(h)
  const reports = model.twinReports.filter(report =>
    report.name.endsWith('.md'),
  )
  const active =
    reports.find(report => report.name === model.twinReportTab) ?? reports[0]
  const editedCount = reports.filter(report => report.isEdited).length
  return h.div(
    [h.Class('report-workspace')],
    [
      h.div(
        [h.Class('report-head')],
        [
          h.div(
            [
              h.Class('segmented run-view-toggle report-tabs'),
              h.Role('group'),
              h.AriaLabel('Reports'),
            ],
            reports.map(report =>
              h.keyed('button')(
                report.name,
                [
                  h.Type('button'),
                  h.Class(
                    `${report.name === active?.name ? 'active' : ''} ${report.isEdited ? 'edited' : ''}`,
                  ),
                  h.AriaPressed(String(report.name === active?.name)),
                  h.Title(
                    report.isEdited ? `${report.name} · edited` : report.name,
                  ),
                  h.OnClick(Message.SelectedTwinReport({ name: report.name })),
                ],
                [reportLabel(report.name)],
              ),
            ),
          ),
          h.div(
            [h.Class('report-head-actions')],
            [
              h.span(
                [h.Class('muted small-text')],
                [
                  [
                    editedCount > 0 ? `${editedCount} edited` : '',
                    syncLabel[model.twinReportSync],
                  ]
                    .filter(Boolean)
                    .join(' · '),
                ],
              ),
              ...actions,
              isExpanded
                ? h.empty
                : h.button(
                    [
                      h.Type('button'),
                      h.Class('button outline'),
                      h.Title('Open in a larger editor'),
                      h.OnClick(Message.OpenedReportEditor()),
                    ],
                    [svgIcon(expandPath, h), 'Expand'],
                  ),
            ],
          ),
        ],
      ),
      isElsewhere
        ? h.p(
            [h.Class('report-elsewhere muted small-text')],
            ['Editing in the expanded editor.'],
          )
        : active
          ? editor([
              h.Class('report-editor'),
              editor.ReportName(active.name),
              editor.Markdown(active.content),
              editor.OnReportInput(detail => Message.EditedTwinReport(detail)),
            ])
          : h.empty,
    ],
  )
}

export const reportEditorModal = (model: Model, h: H): Html =>
  h.div(
    [h.Class('report-editor-expanded')],
    [
      h.p([h.Class('eyebrow')], ['DO-254 reports']),
      h.h2([h.Id('dialog-title')], ['Report editor']),
      reportEditor(model, [], h, true),
    ],
  )

const badgeClass = (status: Requirement['status']): string =>
  status === 'Verified'
    ? 'badge positive'
    : status === 'Needs review'
      ? 'badge warning'
      : 'badge neutral'

const svgIcon = (path: string, h: H): Html =>
  h.span([
    h.Class('icon'),
    h.AriaHidden(true),
    h.InnerHTML(
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`,
    ),
  ])
const checkPath = '<path d="m5 12.5 4.5 4.5L19 7.5"/>'

const signoffButton = (
  model: Model,
  item: TwinReviewItem,
  isEnabled: boolean,
  h: H,
): Html => {
  const isSigned = model.twinReviewed.includes(item)
  return h.button(
    [
      h.Type('button'),
      h.Class('button outline small'),
      h.AriaPressed(String(isSigned)),
      h.AriaLabel(`${isSigned ? 'Revoke' : 'Sign off'} ${signoffTitle(item)}`),
      h.Disabled(!isEnabled),
      h.OnClick(Message.ToggledTwinReview({ item })),
    ],
    [isSigned ? 'Revoke' : 'Sign off'],
  )
}

const signatory = (h: H): Html =>
  h.span([h.Class('twin-signed')], [svgIcon(checkPath, h), 'Dakota Edwards'])

const signoffEvidence = (
  item: TwinReviewItem,
  changeCount: number,
  subsystemCount: number,
): string => {
  if (item === 'Requirements') {
    return `${changeCount} artifacts revised across ${subsystemCount} subsystems`
  }
  const rows = analysisRows.filter(row => row.domain === item)
  const over = rows.filter(row => !withinLimit(row, row.revB)).length
  const low = rows.filter(
    row => withinLimit(row, row.revB) && lowMargin(row),
  ).length
  return [
    `${rows.length} checks`,
    over > 0 ? `${over} over limit` : 'all within limits',
    low > 0 ? `${low} under 10% margin` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

const signoffGate = (
  model: Model,
  isRevB: boolean,
  changeCount: number,
  subsystemCount: number,
  h: H,
): Html => {
  const canSign = isRevB && model.twinReports.length > 0
  return h.div(
    [
      h.Class('twin-signoff'),
      h.Id('twin-signoff'),
      h.AriaLabel('Engineering sign-off'),
    ],
    [
      h.div(
        [h.Class('twin-section-head')],
        [
          h.h3([h.Class('twin-heading')], ['Sign-off']),
          h.span(
            [h.Class('muted small-text')],
            [`${model.twinReviewed.length} of ${twinSignoffs.length} signed`],
          ),
        ],
      ),
      h.table(
        [h.Class('twin-table twin-signoff-table')],
        [
          h.thead(
            [],
            [
              h.tr(
                [],
                [
                  h.th([], ['Discipline']),
                  h.th([], ['Scope']),
                  h.th([], ['Signatory']),
                  h.th([h.AriaLabel('Action')], []),
                ],
              ),
            ],
          ),
          h.tbody(
            [],
            twinSignoffs.map(signoff =>
              h.keyed('tr')(
                signoff.item,
                [],
                [
                  h.td(
                    [],
                    [
                      h.div([], [signoff.title]),
                      h.div([h.Class('muted small-text')], [signoff.role]),
                    ],
                  ),
                  h.td(
                    [h.Class('muted')],
                    [
                      isRevB
                        ? signoffEvidence(
                            signoff.item,
                            changeCount,
                            subsystemCount,
                          )
                        : '—',
                    ],
                  ),
                  h.td(
                    [],
                    [
                      model.twinReviewed.includes(signoff.item)
                        ? signatory(h)
                        : h.span(
                            [h.Class(canSign ? 'amber-text' : 'muted')],
                            ['Pending'],
                          ),
                    ],
                  ),
                  h.td(
                    [h.Class('twin-signoff-action')],
                    [signoffButton(model, signoff.item, canSign, h)],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ],
  )
}

const emptyState = (h: H): Html =>
  h.section(
    [h.Class('panel twin-empty')],
    [
      h.h2([], ['No digital twin in this workspace']),
      h.p(
        [h.Class('muted')],
        [
          'Load the F-35 aft power-supply scenario. It adds the power, thermal, structures, and verification artifacts to the systems model at Rev A.',
        ],
      ),
    ],
  )

const plusIcon = (h: HtmlBuilder<Message>): Html =>
  h.span([
    h.Class('icon'),
    h.AriaHidden(true),
    h.InnerHTML(
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
    ),
  ])

const percent = (value: number): string =>
  `${value >= 0 ? '+' : '−'}${Math.abs(value * 100).toFixed(1)}%`

const kw = (value: number): string => value.toFixed(2)

const capacityBar = (isRevB: boolean, isUpgraded: boolean, h: H): Html => {
  const revision = isRevB ? 'B' : 'A'
  const demand = isUpgraded ? busDemandKw : avionicsChange.existingLoadKw
  const capacity = capacityKw(revision, 1)
  const scale = capacityKw('B', 0)
  const margin = (capacity - demand) / capacity
  const isShort = demand > capacity
  const at = (value: number): string =>
    `${(Math.min(value, scale) / scale) * 100}%`
  return h.div(
    [
      h.Class(`twin-capacity ${isShort ? 'bad' : 'ok'}`),
      h.AriaLabel(
        `Demand ${kw(demand)} kW against ${kw(capacity)} kW N−1 capacity`,
      ),
    ],
    [
      h.div(
        [h.Class('twin-capacity-labels')],
        [
          h.span([], [h.strong([], [`${kw(demand)} kW`]), ' bus demand']),
          h.span(
            [h.Class(`twin-margin ${isShort ? 'bad' : 'ok'}`)],
            [
              isShort
                ? `Short ${kw(demand - capacity)} kW`
                : `${percent(margin)} margin`,
            ],
          ),
        ],
      ),
      h.div(
        [h.Class('twin-capacity-track')],
        [
          h.div(
            [h.Class('twin-capacity-fill'), h.Style({ width: at(capacity) })],
            [],
          ),
          isShort
            ? h.div(
                [
                  h.Class('twin-capacity-over'),
                  h.Style({
                    left: at(capacity),
                    width: `calc(${at(demand)} - ${at(capacity)})`,
                  }),
                ],
                [],
              )
            : h.empty,
          h.div(
            [h.Class('twin-capacity-demand'), h.Style({ left: at(demand) })],
            [],
          ),
        ],
      ),
      h.div(
        [h.Class('twin-capacity-scale mono')],
        [
          h.span([], ['0']),
          h.span([], [`N−1 capacity · Rev ${revision}: ${kw(capacity)} kW`]),
          h.span([], [`${kw(scale)} kW`]),
        ],
      ),
    ],
  )
}

const revBMargin = (): number =>
  (capacityKw('B', 1) - busDemandKw) / capacityKw('B', 1)

const revisionBars = (h: H): Html => {
  const scale = capacityKw('B', 0)
  const at = (value: number): string =>
    `${(Math.min(value, scale) / scale) * 100}%`
  return h.div(
    [
      h.Class('twin-rev-bars'),
      h.AriaLabel(`N−1 capacity against ${kw(busDemandKw)} kW bus demand`),
    ],
    [
      h.p(
        [h.Class('twin-rev-caption mono')],
        [`N−1 capacity vs ${kw(busDemandKw)} kW bus demand`],
      ),
      ...(['A', 'B'] as const).map(revision => {
        const capacity = capacityKw(revision, 1)
        const isShort = busDemandKw > capacity
        return h.keyed('div')(
          revision,
          [h.Class(`twin-rev-row ${isShort ? 'bad' : 'ok'}`)],
          [
            h.span([h.Class('twin-rev-name mono')], [`Rev ${revision}`]),
            h.div(
              [h.Class('twin-rev-track')],
              [
                h.div(
                  [h.Class('twin-rev-fill'), h.Style({ width: at(capacity) })],
                  [],
                ),
                h.div(
                  [
                    h.Class('twin-rev-demand'),
                    h.Style({ left: at(busDemandKw) }),
                  ],
                  [],
                ),
              ],
            ),
            h.span(
              [h.Class('twin-rev-value')],
              [
                `${kw(capacity)} kW · `,
                isShort
                  ? `short ${kw(busDemandKw - capacity)} kW`
                  : `${percent((capacity - busDemandKw) / capacity)} margin`,
              ],
            ),
          ],
        )
      }),
    ],
  )
}

const changeDriver = (isRevB: boolean, isUpgraded: boolean, h: H): Html => {
  return h.div(
    [h.Class('twin-budget'), h.AriaLabel('Power budget')],
    [
      h.span([h.Class('twin-budget-title')], ['Power budget']),
      capacityBar(isRevB, isUpgraded, h),
    ],
  )
}

const slotName = (slot: TwinSlot): string =>
  slot === 'Cockpit' ? 'Cockpit avionics' : 'Aft power assembly'

const slotCard = (model: Model, slot: TwinSlot, h: H): Html => {
  const requirements = model.workspace.requirements
  const part = installedPart(requirements, slot)
  const health = slotHealth(requirements, slot)
  const isFixPending =
    slot === 'Power' &&
    model.twinProposal === 'Pending' &&
    twinRevision(requirements) === 'A'
  return h.div(
    [h.Class(`twin-slot ${health.tone}`)],
    [
      h.div(
        [h.Class('twin-slot-head')],
        [
          h.span([h.Class('twin-slot-name')], [slotName(slot)]),
          h.button(
            [
              h.Type('button'),
              h.Class('button outline small'),
              h.OnClick(Message.OpenedTwinPartPicker({ slot })),
            ],
            ['Replace…'],
          ),
        ],
      ),
      h.p(
        [h.Class(`twin-slot-health ${health.tone}`), h.Title(health.text)],
        [
          slot === 'Cockpit'
            ? (part.specs[0] ?? health.text)
            : (health.text.split(' · ').at(-1) ?? health.text),
          isFixPending
            ? h.span(
                [h.Class('twin-slot-after')],
                [` → ${percent(revBMargin())} with Rev B (pending)`],
              )
            : h.empty,
        ],
      ),
    ],
  )
}

export const twinPartPicker = (
  model: Model,
  picker: Readonly<{ slot: TwinSlot; selectedId: string }>,
  h: H,
): Html => {
  const requirements = model.workspace.requirements
  const installed = installedPart(requirements, picker.slot)
  const items = twinCatalog.filter(item => item.slot === picker.slot)
  const selected =
    items.find(item => item.id === picker.selectedId) ?? installed
  const blocker = catalogBlocker(requirements, selected)
  const impact = catalogImpact(requirements, selected)
  const isSame = selected.id === installed.id
  return h.div(
    [],
    [
      h.p([h.Class('eyebrow')], ['TEAMCENTER']),
      h.h2(
        [h.Id('dialog-title')],
        [`Replace ${slotName(picker.slot).toLowerCase()}`],
      ),
      h.div(
        [h.Class('twin-picker')],
        [
          h.div(
            [
              h.Class('twin-picker-list'),
              h.Role('radiogroup'),
              h.AriaLabel('Teamcenter items'),
            ],
            items.map(item =>
              h.keyed('button')(
                item.id,
                [
                  h.Type('button'),
                  h.Role('radio'),
                  h.AriaChecked(item.id === selected.id),
                  h.Class(
                    `twin-picker-item ${item.id === selected.id ? 'selected' : ''}`,
                  ),
                  h.OnClick(Message.SelectedTwinCatalogItem({ id: item.id })),
                ],
                [
                  h.span(
                    [h.Class('twin-picker-id mono')],
                    [`${item.id} · Rev ${item.revision}`],
                  ),
                  h.span([h.Class('twin-picker-title')], [item.title]),
                  h.span(
                    [h.Class('twin-picker-meta')],
                    [
                      h.span(
                        [
                          h.Class(
                            `badge ${item.status === 'Released' ? 'positive' : 'neutral'}`,
                          ),
                        ],
                        [item.status],
                      ),
                      item.id === installed.id
                        ? h.span([h.Class('badge neutral')], ['Installed'])
                        : h.empty,
                      h.span([h.Class('muted')], [item.released]),
                    ],
                  ),
                ],
              ),
            ),
          ),
          h.div(
            [h.Class('twin-picker-compare')],
            [
              h.table(
                [h.Class('twin-compare')],
                [
                  h.thead(
                    [],
                    [
                      h.tr(
                        [],
                        [
                          h.th([], ['']),
                          h.th([], ['Installed']),
                          h.th([], [isSame ? 'Selected' : selected.id]),
                        ],
                      ),
                    ],
                  ),
                  h.tbody(
                    [],
                    catalogSpecLabels[picker.slot].map((label, index) => {
                      const before = installed.specs[index] ?? '—'
                      const after = selected.specs[index] ?? '—'
                      return h.keyed('tr')(
                        label,
                        [h.Class(before === after ? '' : 'changed')],
                        [
                          h.th([], [label]),
                          h.td([], [before]),
                          h.td([], [after]),
                        ],
                      )
                    }),
                  ),
                ],
              ),
              h.p(
                [h.Class(`twin-picker-impact ${impact.tone}`)],
                [
                  isSame
                    ? `Now: ${impact.text}`
                    : `After install: ${impact.text}`,
                ],
              ),
              blocker ? h.p([h.Class('muted small-text')], [blocker]) : h.empty,
            ],
          ),
        ],
      ),
      h.div(
        [h.Class('modal-footer')],
        [
          h.button(
            [
              h.Type('button'),
              h.Class('button ghost'),
              h.OnClick(Message.ClosedModal()),
            ],
            ['Cancel'],
          ),
          h.button(
            [
              h.Type('button'),
              h.Class('button primary'),
              h.Disabled(blocker !== undefined),
              h.OnClick(Message.ClickedInstallTwinPart()),
            ],
            [`Install ${selected.id}`],
          ),
        ],
      ),
    ],
  )
}

const analysisSummary = (): ReadonlyArray<
  Readonly<{ label: string; tab: BoardReviewTab }>
> => {
  const spice = ltspiceResults()
  const spicePass = spice.filter(result => result.B <= result.limit).length
  const ansysPass = analysisRows.filter(row =>
    withinLimit(row, row.revB),
  ).length
  return [
    { label: `LTspice ${spicePass}/${spice.length}`, tab: 'Electrical' },
    {
      label: `Ansys ${ansysPass}/${analysisRows.length}`,
      tab: 'Thermal',
    },
    { label: 'KiCad schematic', tab: 'Schematic' },
  ]
}

const analysisLine = (isReviewable: boolean, h: H): Html =>
  h.p(
    [h.Class('twin-analysis-line'), h.AriaLabel('Analysis checks')],
    analysisSummary().map(item => {
      const content = [
        svgIcon('<path d="m5 12.5 4.5 4.5L19 7.5"/>', h),
        item.label,
      ]
      return isReviewable
        ? h.button(
            [
              h.Type('button'),
              h.Class('twin-pass'),
              h.Title(`Open ${item.tab}`),
              h.OnClick(Message.OpenedBoardReviewAt({ tab: item.tab })),
            ],
            content,
          )
        : h.span([h.Class('twin-pass')], content)
    }),
  )

const proposalPanel = (model: Model, isRevB: boolean, h: H): Html => {
  const proposal = model.twinProposal
  const reviewer = `${proposalReviewer.name} · ${proposalReviewer.role}`
  const head = h.div(
    [h.Class('twin-section-head')],
    [
      h.h2([h.Class('twin-heading')], ['Power board redesign · MPA Rev B']),
      isRevB
        ? h.span([h.Class('badge positive')], ['Approved · installed'])
        : proposal === 'Rejected'
          ? h.span([h.Class('badge danger')], ['Rejected'])
          : h.empty,
      ...jiraHandoffs(model.workspace.requirements, proposal).map(ticket =>
        jiraChip(ticket, h),
      ),
    ],
  )
  const body =
    !isRevB && (proposal === 'None' || proposal === 'Approved')
      ? [
          h.p(
            [h.Class('muted small-text')],
            [
              `${avionicsRequirementIds.length} requirements were revised. Ask the power agent to redesign the board against them.`,
            ],
          ),
          h.button(
            [
              h.Type('button'),
              h.Class('button primary small'),
              h.OnClick(Message.ClickedDraftTwinProposal()),
            ],
            ['Ask agent for a redesign'],
          ),
        ]
      : proposal === 'Drafting' && !isRevB
        ? [
            h.p(
              [h.Class('twin-drafting')],
              [
                h.span([h.Class('twin-pulse')], []),
                `Power agent is checking ${avionicsRequirementIds.length} revised requirements against the installed power assembly and drafting part changes…`,
              ],
            ),
          ]
        : [
            h.p(
              [h.Class('twin-proposal-why')],
              [
                'Proposed by the power agent to meet ',
                ...avionicsRequirementIds.flatMap((id, index) =>
                  index > 0
                    ? [', ', idLink(model, id, h, 'mono')]
                    : [idLink(model, id, h, 'mono')],
                ),
                '.',
              ],
            ),
            revisionBars(h),
            analysisLine(proposal === 'Pending', h),
            h.div(
              [h.Class(`twin-approver ${isRevB ? 'ok' : ''}`)],
              isRevB
                ? [
                    h.p(
                      [],
                      [
                        `Approved by ${reviewer}. MW-MPA-48-5 Rev B is installed in the twin.`,
                      ],
                    ),
                  ]
                : proposal === 'Rejected'
                  ? [
                      h.p(
                        [],
                        [`Rejected by ${reviewer}. Rev A stays in the twin.`],
                      ),
                      h.button(
                        [
                          h.Type('button'),
                          h.Class('button outline small'),
                          h.OnClick(Message.ClickedDraftTwinProposal()),
                        ],
                        ['Ask agent to revise'],
                      ),
                    ]
                  : [
                      h.p(
                        [h.Class('twin-waiting')],
                        [
                          svgIcon(
                            '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
                            h,
                          ),
                          h.strong([], [`Waiting on ${proposalReviewer.name}`]),
                          ` · ${proposalReviewer.role}`,
                        ],
                      ),
                      h.div(
                        [h.Class('twin-approver-actions')],
                        [
                          h.button(
                            [
                              h.Type('button'),
                              h.Class('button primary small'),
                              h.OnClick(Message.OpenedBoardReview()),
                            ],
                            ['Review Rev A → Rev B'],
                          ),
                        ],
                      ),
                    ],
            ),
          ]
  return h.section(
    [h.Class('panel twin-wide'), h.AriaLabel('Power board redesign')],
    [head, ...body],
  )
}

const checkPanel = (model: Model, h: H): Html => {
  const requirements = model.workspace.requirements
  const checks = requirementChecks('B')
  const passed = checks.filter(check => check.isPass).length
  const queue = twinChanges(requirements).filter(
    change => change.status !== 'Verified',
  )
  const head = h.div(
    [h.Class('twin-section-head')],
    [
      h.h3([h.Class('twin-subheading')], ['Requirement check']),
      model.twinCheck === 'Done'
        ? h.button(
            [
              h.Type('button'),
              h.Class('button outline small'),
              h.OnClick(Message.ClickedOpenTwinMatrix()),
            ],
            ['Open traceability matrix'],
          )
        : h.empty,
    ],
  )
  if (model.twinCheck !== 'Done') {
    return h.div(
      [],
      [
        head,
        model.twinCheck === 'Running'
          ? h.p(
              [h.Class('twin-drafting')],
              [
                h.span([h.Class('twin-pulse')], []),
                `Checking ${checks.length} requirement checks against MW-MPA-48-5 Rev B and walking the trace links…`,
              ],
            )
          : h.div(
              [],
              [
                h.p(
                  [h.Class('muted small-text')],
                  ['Requirement check did not finish.'],
                ),
                h.button(
                  [
                    h.Type('button'),
                    h.Class('button outline small'),
                    h.OnClick(Message.ClickedRunTwinCheck()),
                  ],
                  ['Run again'],
                ),
              ],
            ),
      ],
    )
  }
  return h.div(
    [h.AriaLabel('Requirement check')],
    [
      head,
      h.p(
        [h.Class('twin-check-summary')],
        [
          h.strong(
            [
              h.Class(
                passed === checks.length ? 'twin-margin ok' : 'twin-margin bad',
              ),
            ],
            [`${passed} of ${checks.length} checks pass`],
          ),
          ` · ${queue.length} artifacts need re-verification before the change closes`,
        ],
      ),
      h.table(
        [h.Class('twin-table')],
        [
          h.thead(
            [],
            [
              h.tr(
                [],
                [
                  'Requirement',
                  'Check',
                  'Rev B',
                  'Limit',
                  'Result',
                  'Re-verify by',
                ].map(label => h.th([], [label])),
              ),
            ],
          ),
          h.tbody(
            [],
            checks.map(check =>
              h.keyed('tr')(
                `${check.id}-${check.check}`,
                [],
                [
                  h.td([], [idLink(model, check.id, h, 'mono small-text')]),
                  h.td([], [check.check]),
                  h.td([h.Class('mono')], [check.value]),
                  h.td([h.Class('mono')], [check.limit]),
                  h.td(
                    [],
                    [
                      h.span(
                        [
                          h.Class(
                            check.isPass ? 'badge positive' : 'badge warning',
                          ),
                        ],
                        [check.isPass ? 'Pass' : 'Fail'],
                      ),
                    ],
                  ),
                  h.td(
                    [],
                    [
                      check.verification,
                      ...check.tests.flatMap(id => [
                        ' · ',
                        idLink(model, id, h, 'mono'),
                      ]),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      h.h3([h.Class('twin-subheading')], ['Re-verification queue']),
      h.table(
        [h.Class('twin-table')],
        [
          h.thead(
            [],
            [
              h.tr(
                [],
                ['Artifact', 'Kind', 'Method', 'Owner', 'Status', ''].map(
                  label => h.th([], [label]),
                ),
              ),
            ],
          ),
          h.tbody(
            [],
            queue.map(change =>
              h.keyed('tr')(
                change.artifact.id,
                [],
                [
                  h.td(
                    [],
                    [
                      idLink(model, change.artifact.id, h, 'mono small-text'),
                      h.div([], [change.artifact.title]),
                    ],
                  ),
                  h.td([], [change.artifact.kind]),
                  h.td([], [change.artifact.verification]),
                  h.td([], [change.artifact.owner]),
                  h.td(
                    [],
                    [
                      h.span(
                        [h.Class(badgeClass(change.status))],
                        [change.status],
                      ),
                    ],
                  ),
                  h.td(
                    [],
                    [
                      h.button(
                        [
                          h.Type('button'),
                          h.Class('button outline small'),
                          h.OnClick(
                            Message.ClickedTraceTwinArtifact({
                              id: change.artifact.id,
                            }),
                          ),
                        ],
                        ['Trace'],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ],
  )
}

const changeTable = (
  model: Model,
  changes: ReadonlyArray<TwinChange>,
  isDerived: boolean,
  h: H,
): Html =>
  h.table(
    [h.Class('twin-table')],
    [
      h.thead(
        [],
        [
          h.tr(
            [],
            [
              'Artifact',
              'Subsystem',
              ...(isDerived ? [] : ['Before']),
              isDerived ? 'Requirement' : 'After',
              'Status',
              '',
            ].map(label => h.th([], [label])),
          ),
        ],
      ),
      h.tbody(
        [],
        changes.map(change =>
          h.keyed('tr')(
            change.artifact.id,
            [],
            [
              h.td(
                [],
                [
                  idLink(model, change.artifact.id, h, 'mono small-text'),
                  h.div([], [change.artifact.title]),
                ],
              ),
              h.td([], [change.artifact.subsystem]),
              isDerived
                ? h.empty
                : h.td(
                    [h.Class('twin-before')],
                    linkifyIds(model, change.before, h),
                  ),
              h.td([h.Class('twin-after')], linkifyIds(model, change.after, h)),
              h.td(
                [],
                [
                  h.span([h.Class(badgeClass(change.status))], [change.status]),
                  h.div(
                    [h.Class('mono small-text muted')],
                    [`r${change.revision}`],
                  ),
                ],
              ),
              h.td(
                [],
                [
                  h.button(
                    [
                      h.Type('button'),
                      h.Class('button outline small'),
                      h.OnClick(
                        Message.ClickedTraceTwinArtifact({
                          id: change.artifact.id,
                        }),
                      ),
                    ],
                    ['Trace in graph'],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    ],
  )

const baselineTable = (model: Model, h: H): Html =>
  h.table(
    [h.Class('twin-table')],
    [
      h.thead(
        [],
        [
          h.tr(
            [],
            ['Artifact', 'Subsystem', 'Requirement'].map(label =>
              h.th([], [label]),
            ),
          ),
        ],
      ),
      h.tbody(
        [],
        twinArtifacts
          .filter(artifact => avionicsRequirementIds.includes(artifact.id))
          .map(artifact =>
            h.keyed('tr')(
              artifact.id,
              [],
              [
                h.td(
                  [],
                  [
                    idLink(model, artifact.id, h, 'mono small-text'),
                    h.div([], [artifact.title]),
                  ],
                ),
                h.td([], [artifact.subsystem]),
                h.td([], linkifyIds(model, artifact.revA, h)),
              ],
            ),
          ),
      ),
    ],
  )

type RequirementSet = Readonly<{
  id: string
  title: string
  trigger: string
  summary: string
  body: () => Html
}>

const requirementSets = (model: Model, h: H): ReadonlyArray<RequirementSet> => {
  const requirements = model.workspace.requirements
  const changes = twinChanges(requirements)
  const revised = changes.filter(change =>
    avionicsRequirementIds.includes(change.artifact.id),
  )
  const derived = changes.filter(change => change.before === '')
  const checks = requirementChecks('B')
  const passed = checks.filter(check => check.isPass).length
  const baseline: RequirementSet = {
    id: 'baseline',
    title: 'Baseline',
    trigger: 'Rev A power assembly',
    summary: `${avionicsRequirementIds.length} requirements`,
    body: () => baselineTable(model, h),
  }
  const swap: ReadonlyArray<RequirementSet> =
    revised.length > 0
      ? [
          {
            id: 'avionics',
            title: 'Avionics swap',
            trigger: avionicsChange.title,
            summary: `${revised.length} changed`,
            body: () => changeTable(model, revised, false, h),
          },
        ]
      : []
  const proposal: ReadonlyArray<RequirementSet> =
    derived.length > 0
      ? [
          {
            id: 'derived',
            title: 'Power agent proposal',
            trigger: 'Rev A → Rev B board change',
            summary: `+${derived.length} derived`,
            body: () =>
              h.div(
                [],
                [
                  changeTable(model, derived, true, h),
                  isApprovedReview(model)
                    ? h.p(
                        [h.Class('twin-req-set-actions')],
                        [
                          h.button(
                            [
                              h.Type('button'),
                              h.Class('text-button'),
                              h.OnClick(Message.OpenedBoardReview()),
                            ],
                            ['Open approved review →'],
                          ),
                        ],
                      )
                    : h.empty,
                ],
              ),
          },
        ]
      : []
  const installed: ReadonlyArray<RequirementSet> =
    twinRevision(requirements) === 'B'
      ? [
          {
            id: 'rev-b',
            title: 'Rev B installed',
            trigger: `Approved by ${proposalReviewer.name}`,
            summary:
              model.twinCheck === 'Done'
                ? `${passed}/${checks.length} checks pass`
                : model.twinCheck === 'Running'
                  ? 'Checking…'
                  : 'Check not finished',
            body: () => checkPanel(model, h),
          },
        ]
      : []
  return [...installed, ...proposal, ...swap, baseline]
}

const requirementChangesPanel = (model: Model, h: H): Html => {
  const sets = requirementSets(model, h)
  const newest = sets[0]?.id ?? ''
  const open =
    model.openRequirementSetOf === newest ? model.openRequirementSet : newest
  const isPending =
    twinChanges(model.workspace.requirements).length > 0 &&
    !(
      twinRevision(model.workspace.requirements) === 'B' &&
      model.twinCheck === 'Done'
    )
  return h.section(
    [h.Class('panel twin-wide')],
    [
      h.div(
        [h.Class('twin-section-head')],
        [
          h.h2([h.Class('twin-heading')], ['Requirement history']),
          isPending
            ? h.span([h.Class('badge warning')], ['DOORS change set pending'])
            : h.empty,
        ],
      ),
      h.ol(
        [h.Class('twin-req-sets')],
        sets.map(set => {
          const isOpen = set.id === open
          return h.keyed('li')(
            set.id,
            [h.Class(`twin-req-set${isOpen ? ' open' : ''}`)],
            [
              h.button(
                [
                  h.Type('button'),
                  h.Class('twin-req-set-row'),
                  h.AriaExpanded(isOpen),
                  h.OnClick(
                    Message.ToggledRequirementSet({ id: set.id, newest }),
                  ),
                ],
                [
                  h.span([h.Class('twin-req-set-chevron')], []),
                  h.strong([], [set.title]),
                  h.span([h.Class('muted')], [set.trigger]),
                  set.id === newest
                    ? h.span([h.Class('badge neutral')], ['Current'])
                    : h.empty,
                  h.span([h.Class('twin-req-set-summary mono')], [set.summary]),
                ],
              ),
              isOpen
                ? h.div([h.Class('twin-req-set-body')], [set.body()])
                : h.empty,
            ],
          )
        }),
      ),
    ],
  )
}

const do254Panel = (model: Model, h: H): Html => {
  const isRevB = twinRevision(model.workspace.requirements) === 'B'
  const isReviewed = model.twinReviewed.length === twinSignoffs.length
  const isVerified = isRevB && model.twinCheck === 'Done'
  const pkg = model.maybeTwinPackage
  const hasReports = model.twinReports.length > 0
  return h.section(
    [h.Class('panel twin-wide')],
    [
      Option.match(pkg, {
        onNone: () =>
          hasReports
            ? reportEditor(
                model,
                [
                  h.button(
                    [
                      h.Type('button'),
                      h.Class('button primary'),
                      h.Title(
                        isReviewed ? '' : 'Sign off all disciplines first',
                      ),
                      h.Disabled(!isReviewed || model.isGeneratingTwinPackage),
                      h.OnClick(Message.ClickedDownloadTwinPackage()),
                    ],
                    [
                      model.isGeneratingTwinPackage
                        ? 'Packaging…'
                        : 'Download package',
                    ],
                  ),
                ],
                h,
              )
            : h.div(
                [],
                [
                  h.p(
                    [h.Class('muted small-text')],
                    [
                      isVerified
                        ? 'Drafts the HRD and DO-254 reports from the systems model for you to review and edit.'
                        : 'Available once Rev B passes the requirement check.',
                    ],
                  ),
                  h.button(
                    [
                      h.Type('button'),
                      h.Class('button primary'),
                      h.Disabled(!isVerified || model.isGeneratingTwinPackage),
                      h.OnClick(Message.ClickedGenerateTwinPackage()),
                    ],
                    [
                      model.isGeneratingTwinPackage
                        ? 'Packaging…'
                        : 'Draft DO-254 reports',
                    ],
                  ),
                ],
              ),
        onSome: item =>
          h.div(
            [h.Class('twin-package')],
            [
              h.p(
                [
                  h.Class('twin-package-meta muted small-text'),
                  h.Title(`${item.files.join('\n')}\nSHA-256 ${item.digest}`),
                ],
                [
                  h.span([h.Class('mono')], [item.name]),
                  ` · ${(item.bytes / 1024).toFixed(1)} KB · ${item.files.length} files`,
                ],
              ),
              reportEditor(
                model,
                [
                  h.button(
                    [
                      h.Type('button'),
                      h.Class('button outline'),
                      h.OnClick(Message.ClickedDownloadTwinPackage()),
                    ],
                    ['Download'],
                  ),
                  item.isSent
                    ? h.span([h.Class('badge positive')], ['Sent to customer'])
                    : h.button(
                        [
                          h.Type('button'),
                          h.Class('button primary'),
                          h.OnClick(Message.ClickedMarkTwinPackageSent()),
                        ],
                        ['Mark as sent'],
                      ),
                ],
                h,
              ),
            ],
          ),
      }),
      hasReports ? signoffPanel(model, h) : h.empty,
    ],
  )
}
const changeStatus = (
  model: Model,
): Readonly<{ label: string; tone: string }> => {
  const requirements = model.workspace.requirements
  const proposal = model.twinProposal
  if (!isAvionicsUpgraded(requirements)) {
    return { label: 'Baseline', tone: 'neutral' }
  }
  if (twinRevision(requirements) !== 'B') {
    return proposal === 'Pending'
      ? { label: 'In review', tone: 'warning' }
      : proposal === 'Rejected'
        ? { label: 'Rejected', tone: 'danger' }
        : proposal === 'Drafting'
          ? { label: 'Drafting', tone: 'neutral' }
          : { label: 'Impact', tone: 'warning' }
  }
  return Option.match(model.maybeTwinPackage, {
    onSome: item =>
      item.isSent
        ? { label: 'Package sent', tone: 'positive' }
        : { label: 'Package ready', tone: 'positive' },
    onNone: () =>
      model.twinReports.length > 0
        ? model.twinReviewed.length === twinSignoffs.length
          ? { label: 'Signed off', tone: 'positive' }
          : { label: 'In sign-off', tone: 'warning' }
        : model.twinCheck === 'Done'
          ? { label: 'Verified', tone: 'positive' }
          : { label: 'Approved', tone: 'positive' },
  })
}

const changeHeader = (model: Model, h: H): Html => {
  const requirements = model.workspace.requirements
  const isUpgraded = isAvionicsUpgraded(requirements)
  const isRevB = twinRevision(requirements) === 'B'
  const status = changeStatus(model)
  const title = !isUpgraded
    ? 'Baseline configuration'
    : isRevB
      ? 'Power assembly Rev B'
      : 'Power assembly Rev A → Rev B'
  return h.header(
    [h.Class('twin-head')],
    [
      h.div(
        [h.Class('twin-head-main')],
        [
          h.h1([h.Class('twin-title')], [title]),
          h.span([h.Class(`badge ${status.tone}`)], [status.label]),
          ...jiraHandoffs(requirements, model.twinProposal).map(ticket =>
            jiraChip(ticket, h, false),
          ),
        ],
      ),
      h.div(
        [h.Class('twin-head-actions')],
        [
          h.div(
            [h.Class('twin-more')],
            [
              h.button(
                [
                  h.Type('button'),
                  h.Class('button outline twin-more-toggle'),
                  h.AriaLabel('More actions'),
                  h.AriaExpanded(model.isTwinMenuOpen),
                  h.OnClick(Message.ToggledTwinMenu()),
                ],
                ['⋯'],
              ),
              model.isTwinMenuOpen
                ? h.div(
                    [h.Class('twin-more-menu')],
                    [
                      h.button(
                        [
                          h.Type('button'),
                          h.Disabled(!isUpgraded),
                          h.OnClick(
                            Message.ClickedTraceTwinArtifact({
                              id: avionicsRequirementIds[0] ?? 'REQ-AVN-01',
                            }),
                          ),
                        ],
                        ['Trace in graph'],
                      ),
                      h.button(
                        [
                          h.Type('button'),
                          h.Disabled(!isUpgraded && !isRevB),
                          h.Title(
                            'Put back the original avionics and power assembly Rev A',
                          ),
                          h.OnClick(Message.ClickedResetTwin()),
                        ],
                        ['Reset to baseline'],
                      ),
                    ],
                  )
                : h.empty,
            ],
          ),
        ],
      ),
    ],
  )
}

const lifecycle = (model: Model, h: H): Html => {
  const requirements = model.workspace.requirements
  const isUpgraded = isAvionicsUpgraded(requirements)
  const isRevB = twinRevision(requirements) === 'B'
  const proposal = model.twinProposal
  const checks = requirementChecks('B')
  const passed = checks.filter(check => check.isPass).length
  const hasProposal =
    isRevB || proposal === 'Pending' || proposal === 'Rejected'
  const stages: ReadonlyArray<
    Readonly<{
      label: string
      meta: string
      hint?: string | undefined
      isDone: boolean
      message: Message
    }>
  > = [
    {
      label: 'Impact',
      meta: isUpgraded
        ? `${avionicsRequirementIds.length} requirements`
        : 'No change yet',
      isDone: isUpgraded,
      message: Message.SelectedTwinPanelTab({ tab: 'Change' }),
    },
    {
      label: 'Proposed',
      meta: proposal === 'Drafting' ? 'Power agent drafting…' : 'Power agent',
      hint: hasProposal
        ? `Power agent · ${analysisSummary()
            .map(item => item.label)
            .join(' · ')}`
        : undefined,
      isDone: isRevB || proposal === 'Pending' || proposal === 'Rejected',
      message: Message.SelectedTwinPanelTab({ tab: 'Change' }),
    },
    {
      label: 'Derived reqs',
      meta:
        isRevB || proposal === 'Pending' || proposal === 'Rejected'
          ? `${derivedArtifacts.length} from Rev B design`
          : 'From the design',
      hint: hasProposal
        ? `${avionicsRequirementIds.length} revised · ${derivedArtifacts.length} derived`
        : undefined,
      isDone: isRevB || proposal === 'Pending' || proposal === 'Rejected',
      message: Message.SelectedTwinPanelTab({ tab: 'Requirements' }),
    },
    {
      label: 'EE approval',
      meta:
        proposal === 'Rejected' && !isRevB ? 'Rejected' : proposalReviewer.name,
      isDone: isRevB,
      message:
        (proposal === 'Pending' && !isRevB) || isApprovedReview(model)
          ? Message.OpenedBoardReview()
          : Message.SelectedTwinPanelTab({ tab: 'Change' }),
    },
    {
      label: 'Verified',
      meta:
        isRevB && model.twinCheck === 'Done'
          ? `${passed}/${checks.length} checks`
          : 'Requirement check',
      isDone: isRevB && model.twinCheck === 'Done',
      message: Message.SelectedTwinPanelTab({ tab: 'Requirements' }),
    },
    {
      label: 'DO-254',
      meta: model.twinReports.length > 0 ? 'Reports drafted' : 'Data package',
      isDone: isRevB && model.twinReports.length > 0,
      message: Message.SelectedTwinPanelTab({ tab: 'DO-254' }),
    },
    {
      label: 'Sign-off',
      meta: Option.exists(model.maybeTwinPackage, item => item.isSent)
        ? 'Sent to customer'
        : `${model.twinReviewed.length}/${twinSignoffs.length} disciplines`,
      isDone: Option.exists(model.maybeTwinPackage, item => item.isSent),
      message: Message.ClickedTwinSignoffStep(),
    },
  ]
  const current = stages.findIndex(stage => !stage.isDone)
  return h.ol(
    [h.Class('twin-life'), h.AriaLabel('Change lifecycle')],
    stages.map((stage, index) =>
      h.keyed('li')(
        stage.label,
        [
          h.Class(
            `twin-life-stage ${stage.isDone ? 'done' : index === current ? 'current' : ''}`,
          ),
        ],
        [
          h.button(
            [
              h.Type('button'),
              h.Class('twin-life-button'),
              h.Title(stage.hint ?? stage.meta),
              h.OnClick(stage.message),
            ],
            [
              h.span([h.Class('twin-life-mark'), h.AriaHidden(true)], []),
              h.span([h.Class('twin-life-label')], [stage.label]),
            ],
          ),
        ],
      ),
    ),
  )
}

const twinActivity = (model: Model): ReadonlyArray<string> => {
  const events = model.workspace.events
  const start = events.findIndex(event => event.includes('scenario added'))
  return start < 0 ? [] : events.slice(0, start + 1)
}

const activityTimeFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

const isApprovedReview = (model: Model): boolean =>
  model.twinProposal === 'Approved' &&
  twinRevision(model.workspace.requirements) === 'B'

const approvalTime = (model: Model): ReadonlyArray<number> => {
  const index = model.workspace.events.findIndex(event =>
    event.startsWith('MPA Rev B proposal approved'),
  )
  const at = model.workspace.eventTimes[index]
  return index >= 0 && at !== undefined && at > 0 ? [at] : []
}

const activityTime = (at: number | undefined, h: H): Html =>
  at === undefined || at === 0
    ? h.empty
    : h.span(
        [
          h.Class('twin-activity-time mono muted'),
          h.Title(new Date(at).toISOString()),
        ],
        [activityTimeFormat.format(at)],
      )

const activityPanel = (model: Model, h: H): Html => {
  const events = twinActivity(model)
  return h.section(
    [h.Class('panel twin-wide'), h.AriaLabel('Activity')],
    [
      events.length === 0
        ? h.p([h.Class('muted small-text')], ['No activity yet.'])
        : h.ol(
            [h.Class('twin-activity')],
            events.map((event, index) =>
              h.keyed('li')(
                String(events.length - index),
                [],
                [
                  h.span([], [event]),
                  activityTime(model.workspace.eventTimes[index], h),
                ],
              ),
            ),
          ),
    ],
  )
}

const panelTabs = (model: Model, h: H): Html => {
  const requirements = model.workspace.requirements
  const counts: Readonly<Record<TwinPanelTab, string>> = {
    Change: '',
    Requirements: requirementsChangeLabel(
      requirements,
      model.twinProposal === 'Pending' || model.twinProposal === 'Rejected',
    ),
    'DO-254':
      model.twinReports.length > 0
        ? `${model.twinReviewed.length}/${twinSignoffs.length}`
        : '',
    Activity: String(twinActivity(model).length),
  }
  return h.div(
    [h.Class('twin-tabs'), h.Role('tablist'), h.AriaLabel('Change details')],
    TwinPanelTab.literals.map(tab =>
      h.keyed('button')(
        tab,
        [
          h.Type('button'),
          h.Role('tab'),
          h.AriaSelected(tab === model.twinPanelTab),
          h.Class(`twin-tab ${tab === model.twinPanelTab ? 'active' : ''}`),
          h.OnClick(Message.SelectedTwinPanelTab({ tab })),
        ],
        [
          h.span([
            h.Class('icon twin-tab-icon'),
            h.AriaHidden(true),
            h.InnerHTML(
              `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${twinTabIcons[tab]}</svg>`,
            ),
          ]),
          tab,
          !counts[tab] ||
          (tab === 'Requirements' &&
            (model.twinPanelTab === 'Requirements' ||
              counts[tab] === model.seenRequirementsLabel))
            ? h.empty
            : tab === 'Requirements'
              ? h.span(
                  [
                    h.Class('twin-tab-dot'),
                    h.Title('New requirement changes'),
                    h.AriaLabel('Changed'),
                  ],
                  [],
                )
              : h.span([h.Class('twin-tab-count')], [counts[tab]]),
        ],
      ),
    ),
  )
}

const twinTabIcons: Readonly<Record<TwinPanelTab, string>> = {
  Change: '<path d="m12 3 9 5v9l-9 5-9-5V8Zm-9 5 9 5 9-5M12 13v9"/>',
  Requirements:
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  'DO-254':
    '<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z"/><path d="m8 12 3 3 5-6"/>',
  Activity: '<path d="M2 12h5l3-9 4 18 3-9h5"/>',
}

const changePanel = (model: Model, h: H): Html => {
  const requirements = model.workspace.requirements
  const isUpgraded = isAvionicsUpgraded(requirements)
  const isRevB = twinRevision(requirements) === 'B'
  return h.div(
    [h.Class('twin-panel-stack')],
    [
      h.div(
        [h.Class('twin-slots'), h.AriaLabel('Installed parts')],
        [slotCard(model, 'Cockpit', h), slotCard(model, 'Power', h)],
      ),
      isRevB || !isUpgraded ? h.empty : proposalPanel(model, isRevB, h),
    ],
  )
}

const signoffPanel = (model: Model, h: H): Html => {
  const requirements = model.workspace.requirements
  const changes = twinChanges(requirements)
  return signoffGate(
    model,
    twinRevision(requirements) === 'B',
    changes.length,
    affectedSubsystems(changes).length,
    h,
  )
}

const detailPanel = (model: Model, h: H): Html =>
  model.twinPanelTab === 'Requirements'
    ? requirementChangesPanel(model, h)
    : model.twinPanelTab === 'DO-254'
      ? do254Panel(model, h)
      : model.twinPanelTab === 'Activity'
        ? activityPanel(model, h)
        : changePanel(model, h)

export const twinPage = (model: Model, h: H): Html => {
  const twin = twinSpec.withMessage(h)
  const requirements = model.workspace.requirements
  const isLoaded = hasTwinScenario(requirements)
  const revision = twinRevision(requirements)
  const isRevB = revision === 'B'
  const isUpgraded = isAvionicsUpgraded(requirements)
  if (!isLoaded) {
    return h.div(
      [h.Class('twin-page')],
      [
        pageHeading(
          'Digital twin',
          '',
          h.button(
            [
              h.Type('button'),
              h.Class('button primary'),
              h.OnClick(Message.ClickedLoadTwinScenario()),
            ],
            [plusIcon(h), 'Load F-35 power scenario'],
          ),
          h,
        ),
        emptyState(h),
      ],
    )
  }
  return h.div(
    [h.Class('twin-page')],
    [
      changeHeader(model, h),
      lifecycle(model, h),
      h.div(
        [h.Class('twin-layout')],
        [
          h.section(
            [h.Class('panel twin-stage')],
            [
              twin([
                h.Class('twin-canvas'),
                h.AriaLabel(
                  '3D model of the F-35 with the aft modular power assembly and the new cockpit avionics module',
                ),
                twin.TwinFocus(model.twinFocus),
                twin.TwinRevision(revision),
                twin.TwinAvionicsUpgraded(isUpgraded),
                twin.OnTwinPick(detail =>
                  detail.part === 'None'
                    ? Message.SelectedTwinFocus({ focus: 'Airframe' })
                    : Message.ClickedTwinPart({ part: detail.part }),
                ),
              ]),
              h.div(
                [h.Class('twin-overlay')],
                [
                  changeDriver(isRevB, isUpgraded, h),
                  h.div(
                    [h.Class('twin-legend')],
                    [
                      h.span([], ['40 °C']),
                      h.span([h.Class('twin-ramp')], []),
                      h.span([], ['95 °C']),
                    ],
                  ),
                ],
              ),
              h.div(
                [h.Class('twin-views'), h.Role('group'), h.AriaLabel('Camera')],
                (['Airframe', 'Aft bay', 'Cockpit'] as const).map(focus =>
                  h.keyed('button')(
                    focus,
                    [
                      h.Type('button'),
                      h.Class(
                        `twin-view ${focus === model.twinFocus ? 'active' : ''}`,
                      ),
                      h.AriaPressed(String(focus === model.twinFocus)),
                      h.OnClick(Message.SelectedTwinFocus({ focus })),
                    ],
                    [focus],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
      panelTabs(model, h),
      h.div([h.Class('twin-detail')], [detailPanel(model, h)]),
    ],
  )
}

const diffClass = (state: DiffState): string => `diff-${state.toLowerCase()}`

const schematicNote = (board: number, sheet: string, h: H): Html => {
  const isBuck = sheet === 'Buck power'
  if (board === 0 && !isBuck) {
    return h.empty
  }
  return h.span(
    [h.Class(isBuck ? 'schematic-note changed' : 'schematic-note')],
    [
      isBuck
        ? board === 0
          ? 'Q401–Q404 replaced in Rev B'
          : 'Q401–Q404: CSD19532Q5B → CSD19536KTT'
        : 'No change from Rev A',
    ],
  )
}

const schematicViewer = (model: Model, h: H): Html => {
  const board = schematicBoards[model.schematicBoard] ?? schematicBoards[0]
  const page = Math.min(model.schematicPage, board.sheets.length - 1)
  const sheet = board.sheets[page] ?? ''
  return h.figure(
    [h.Class('schematic-viewer')],
    [
      h.div(
        [h.Class('schematic-viewer-bar')],
        [
          h.div(
            [
              h.Class('schematic-boards'),
              h.Role('group'),
              h.AriaLabel('Revision'),
            ],
            schematicBoards.map((item, index) =>
              h.keyed('button')(
                item.name,
                [
                  h.Type('button'),
                  h.Class(
                    index === model.schematicBoard
                      ? 'schematic-page active'
                      : 'schematic-page',
                  ),
                  h.AriaPressed(
                    index === model.schematicBoard ? 'true' : 'false',
                  ),
                  h.OnClick(
                    Message.SelectedSchematicSheet({
                      board: index,
                      page: model.schematicPage,
                    }),
                  ),
                ],
                [item.name],
              ),
            ),
          ),
          h.div(
            [
              h.Class('schematic-pages'),
              h.Role('group'),
              h.AriaLabel('Schematic sheet'),
            ],
            board.sheets.map((name, index) =>
              h.keyed('button')(
                name,
                [
                  h.Type('button'),
                  h.Class(`schematic-page ${index === page ? 'active' : ''}`),
                  h.AriaPressed(index === page ? 'true' : 'false'),
                  h.OnClick(
                    Message.SelectedSchematicSheet({
                      board: model.schematicBoard,
                      page: index,
                    }),
                  ),
                ],
                [name],
              ),
            ),
          ),
          schematicNote(model.schematicBoard, sheet, h),
        ],
      ),
      h.img([
        h.Class('schematic-image'),
        h.Src(
          `/schematics/${board.dir}/page-${String(page + 1).padStart(2, '0')}.png`,
        ),
        h.Alt(`KiCad schematic, ${board.name}, ${sheet}`),
      ]),
    ],
  )
}

const diffBadge = (state: DiffState, h: H): Html =>
  h.span([h.Class(`badge ${diffClass(state)}`)], [state])

const revBStem = `${assemblyRevB.id}_${assemblyRevB.revision}`

const schematicTab = (model: Model, h: H): Html =>
  h.div(
    [h.Class('board-review-body')],
    [
      toolHead(kicadLogo(h), [`${revBStem}.kicad_sch`], h),
      schematicViewer(model, h),
      h.table(
        [h.Class('table board-review-table')],
        [
          h.thead(
            [],
            [
              h.tr(
                [],
                ['Part', 'Change', 'Trace', ''].map(label => h.th([], [label])),
              ),
            ],
          ),
          h.tbody(
            [],
            schematicDiff(model.twinDesign).map((row, index) =>
              h.keyed('tr')(
                `${row.part}-${index}`,
                [],
                [
                  h.td([], [row.part]),
                  h.td([], [row.change]),
                  h.td(
                    [],
                    row.trace ? [idLink(model, row.trace, h, 'mono')] : ['—'],
                  ),
                  h.td([], [diffBadge(row.state, h)]),
                ],
              ),
            ),
          ),
        ],
      ),
    ],
  )

const modelTab = (h: H): Html => {
  const board = boardSpec.withMessage(h)
  return h.div(
    [h.Class('board-review-body')],
    [
      board([
        h.Class('board-review-canvas board-review-assembly'),
        h.AriaLabel('3D model of the KiCad power board, Rev A and Rev B'),
      ]),
      h.p(
        [h.Class('muted small')],
        ['Rev A left, Rev B right. Drag to orbit, scroll to zoom.'],
      ),
    ],
  )
}

const heatMap = (revision: 'A' | 'B', h: H): Html =>
  h.figure(
    [h.Class('heat-map')],
    [
      h.figcaption([], [revision === 'A' ? 'Rev A' : 'Rev B']),
      h.img([
        h.Src(
          revision === 'A'
            ? '/ansys-thermal-rev-a.webp'
            : '/ansys-thermal-rev-b.webp',
        ),
        h.Alt(
          revision === 'A'
            ? 'Ansys steady-state thermal result, Rev A'
            : 'Ansys steady-state thermal result, Rev B',
        ),
      ]),
    ],
  )

const electricalTab = (model: Model, h: H): Html => {
  const results = ltspiceResults()
  return h.div(
    [h.Class('board-review-body')],
    [
      toolHead(ltspiceLogo(h), [`${revBStem}_bus.asc`, 'Transient, N−1'], h),
      h.table(
        [h.Class('table board-review-table')],
        [
          h.thead(
            [],
            [
              h.tr(
                [],
                [
                  'Measurement',
                  '.meas',
                  'Rev A',
                  'Rev B',
                  'Limit',
                  'Trace',
                  '',
                ].map(label => h.th([], [label])),
              ),
            ],
          ),
          h.tbody(
            [],
            results.map(row =>
              h.keyed('tr')(
                row.meas,
                [],
                [
                  h.td([], [row.measure]),
                  h.td([h.Class('mono muted')], [row.meas]),
                  h.td(
                    [h.Class(`mono ${row.A > row.limit ? 'spice-over' : ''}`)],
                    [`${row.A.toFixed(2)} ${row.unit}`],
                  ),
                  h.td(
                    [h.Class(`mono ${row.B > row.limit ? 'spice-over' : ''}`)],
                    [`${row.B.toFixed(2)} ${row.unit}`],
                  ),
                  h.td(
                    [h.Class('mono')],
                    [`≤ ${row.limit.toFixed(2)} ${row.unit}`],
                  ),
                  h.td([], [idLink(model, row.traceId, h, 'mono')]),
                  h.td(
                    [],
                    [
                      row.B > row.limit
                        ? h.span([h.Class('badge danger')], ['Over'])
                        : h.span([h.Class('badge positive')], ['Within']),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ],
  )
}

const thermalTab = (h: H): Html =>
  h.div(
    [h.Class('board-review-body')],
    [
      toolHead(
        ansysLogo(h),
        [`${revBStem}_thermal.wbpz`, 'Steady state · solved'],
        h,
      ),
      h.div([h.Class('board-review-pair')], [heatMap('A', h), heatMap('B', h)]),
      h.table(
        [h.Class('table board-review-table')],
        [
          h.thead(
            [],
            [
              h.tr(
                [],
                ['Location', 'Rev A', 'Rev B', 'Limit', 'Rev B margin'].map(
                  label => h.th([], [label]),
                ),
              ),
            ],
          ),
          h.tbody(
            [],
            thermalResults().map(row =>
              h.keyed('tr')(
                row.location,
                [],
                [
                  h.td([], [row.location]),
                  h.td(
                    [
                      h.Class(
                        row.a > (row.limit ?? Infinity) ? 'diff-removed' : '',
                      ),
                    ],
                    [`${row.a.toFixed(1)} °C`],
                  ),
                  h.td(
                    [
                      h.Class(
                        row.b > (row.limit ?? Infinity) ? 'diff-removed' : '',
                      ),
                    ],
                    [`${row.b.toFixed(1)} °C`],
                  ),
                  h.td(
                    [],
                    [row.limit === undefined ? '—' : `≤ ${row.limit} °C`],
                  ),
                  h.td(
                    [],
                    [
                      row.limit === undefined
                        ? '—'
                        : `${(row.limit - row.b).toFixed(1)} °C`,
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      h.details(
        [h.Class('board-review-report')],
        [
          h.summary(
            [],
            ['MOSFET thermal analysis record (Ansys Mechanical, steady state)'],
          ),
          ...thermalReport().map(section =>
            h.keyed('section')(
              section.title,
              [],
              [
                h.h4([], [section.title]),
                h.dl(
                  [h.Class('board-review-facts')],
                  section.rows.flatMap(([term, value]) => [
                    h.dt([], [term]),
                    h.dd([], [value]),
                  ]),
                ),
              ],
            ),
          ),
        ],
      ),
    ],
  )

const designFields: ReadonlyArray<readonly [TwinDesignField, string]> = [
  ['part', 'Part'],
  ['before', 'Rev A'],
  ['after', 'Rev B'],
  ['trace', 'Trace'],
]

const designEditor = (model: Model, h: H): Html =>
  h.details(
    [
      h.Class('board-review-design'),
      ...(isEngineerDesign(model.twinDesign) ? [h.Open(true)] : []),
    ],
    [
      h.summary([], ['Edit design']),
      h.p(
        [h.Class('muted small')],
        [
          'Change any proposed value or add your own part change. The schematic and PDR update to match.',
        ],
      ),
      h.table(
        [h.Class('table board-review-table')],
        [
          h.thead(
            [],
            [
              h.tr(
                [],
                [
                  ...designFields.map(([, label]) => h.th([], [label])),
                  h.th([], ['']),
                ],
              ),
            ],
          ),
          h.tbody(
            [],
            model.twinDesign.map((row, index) =>
              h.keyed('tr')(
                String(index),
                [],
                [
                  ...designFields.map(([field, label]) =>
                    h.td(
                      [],
                      [
                        h.input([
                          h.AriaLabel(`${label}, row ${index + 1}`),
                          h.Value(row[field]),
                          h.Readonly(model.twinProposal !== 'Pending'),
                          h.OnInput(value =>
                            Message.UpdatedTwinDesign({ index, field, value }),
                          ),
                        ]),
                      ],
                    ),
                  ),
                  h.td(
                    [],
                    model.twinProposal !== 'Pending'
                      ? []
                      : [
                          h.button(
                            [
                              h.Type('button'),
                              h.Class('button ghost small'),
                              h.AriaLabel(`Remove row ${index + 1}`),
                              h.OnClick(
                                Message.ClickedRemoveTwinDesignChange({
                                  index,
                                }),
                              ),
                            ],
                            ['Remove'],
                          ),
                        ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      model.twinProposal !== 'Pending'
        ? h.empty
        : h.div(
            [h.Class('board-review-row')],
            [
              h.button(
                [
                  h.Type('button'),
                  h.Class('button outline small'),
                  h.OnClick(Message.ClickedAddTwinDesignChange()),
                ],
                ['Add part change'],
              ),
              h.button(
                [
                  h.Type('button'),
                  h.Class('button ghost small'),
                  h.Disabled(!isEngineerDesign(model.twinDesign)),
                  h.OnClick(Message.ClickedResetTwinDesign()),
                ],
                ["Restore agent's design"],
              ),
            ],
          ),
    ],
  )

const pdrUpload = (model: Model, h: H): Html =>
  Option.match(model.maybeTwinPdr, {
    onNone: () =>
      model.twinProposal !== 'Pending'
        ? h.empty
        : h.label(
            [
              h.Class('button outline small board-review-upload'),
              h.Title('PDF, Word, Markdown or text'),
            ],
            [
              'Attach your PDR…',
              h.input([
                h.Class('visually-hidden'),
                h.Type('file'),
                h.Accept('.pdf,.doc,.docx,.md,.markdown,.txt'),
                h.OnFileChange(files => Message.SelectedTwinPdrFile({ files })),
              ]),
            ],
          ),
    onSome: upload =>
      h.div(
        [h.Class('board-review-uploaded')],
        [
          h.div(
            [h.Class('board-review-row')],
            [
              h.strong([], [upload.name]),
              h.span(
                [h.Class('muted small')],
                [
                  `${Math.max(1, Math.round(upload.size / 1024))} KB · attached to this review`,
                ],
              ),
              model.twinProposal !== 'Pending'
                ? h.empty
                : h.button(
                    [
                      h.Type('button'),
                      h.Class('button ghost small'),
                      h.OnClick(Message.ClickedRemoveTwinPdr()),
                    ],
                    ['Remove'],
                  ),
            ],
          ),
          Option.match(upload.maybeText, {
            onNone: () =>
              h.p(
                [h.Class('muted small')],
                ['Preview is available for Markdown and text files.'],
              ),
            onSome: text => h.pre([h.Class('board-review-pdr-text')], [text]),
          }),
        ],
      ),
  })

const pdrTab = (model: Model, h: H): Html =>
  h.div(
    [h.Class('board-review-body')],
    [
      h.div(
        [h.Class('board-review-meta')],
        [
          h.p(
            [h.Class('board-review-source')],
            [
              h.strong([], [pdr.id]),
              isEngineerDesign(model.twinDesign)
                ? ' · Design edited by the engineer. Items that differ from the agent are marked.'
                : ' · Prepared by the power agent.',
            ],
          ),
          ...Option.match(model.maybeTwinPdr, {
            onNone: () => [pdrUpload(model, h)],
            onSome: () => [],
          }),
        ],
      ),
      ...Option.match(model.maybeTwinPdr, {
        onNone: () => [],
        onSome: () => [pdrUpload(model, h)],
      }),
      h.section(
        [h.Class('board-review-recommendation')],
        [h.h4([], ['Recommendation']), h.p([], [pdr.recommendation])],
      ),
      h.section([], [h.h4([], ['Scope']), h.p([], [pdr.scope])]),
      h.section(
        [],
        [
          h.h4([], ['Entry criteria']),
          h.ul(
            [h.Class('board-review-checks')],
            pdr.entry.map(([label, isMet]) =>
              h.keyed('li')(
                label,
                [h.Class(isMet ? 'met' : 'open')],
                [isMet ? '✓ ' : '○ ', label],
              ),
            ),
          ),
        ],
      ),
      h.section(
        [],
        [
          h.h4([], ['Design changes']),
          h.table(
            [h.Class('table board-review-table')],
            [
              h.thead(
                [],
                [
                  h.tr(
                    [],
                    ['Change', 'Rationale', 'Risk', 'Mitigation', 'Trace'].map(
                      label => h.th([], [label]),
                    ),
                  ),
                ],
              ),
              h.tbody(
                [],
                pdrItems(model.twinDesign).map((item, index) =>
                  h.keyed('tr')(
                    `${item.part}-${index}`,
                    [h.Class(item.isEngineer ? 'engineer-row' : '')],
                    [
                      h.td(
                        [],
                        [
                          item.part,
                          ...(item.isEngineer
                            ? [
                                h.span(
                                  [h.Class('badge diff-changed')],
                                  ['Engineer'],
                                ),
                              ]
                            : []),
                        ],
                      ),
                      h.td([], [item.rationale]),
                      h.td(
                        [],
                        [
                          h.span(
                            [h.Class(`badge risk-${item.risk.toLowerCase()}`)],
                            [item.risk],
                          ),
                        ],
                      ),
                      h.td([], [item.mitigation]),
                      h.td(
                        [],
                        item.trace
                          ? [idLink(model, item.trace, h, 'mono')]
                          : ['—'],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
      designEditor(model, h),
      h.section(
        [],
        [
          h.h4([], ['Action items']),
          h.table(
            [h.Class('table board-review-table board-review-actions')],
            [
              h.thead(
                [],
                [
                  h.tr(
                    [],
                    ['ID', 'Action', 'Owner', 'Due'].map(label =>
                      h.th([], [label]),
                    ),
                  ),
                ],
              ),
              h.tbody(
                [],
                pdr.actions.map(([id, action, owner, due]) =>
                  h.keyed('tr')(
                    id,
                    [],
                    [
                      h.td([h.Class('mono')], [id]),
                      h.td([], [action]),
                      h.td([], [owner]),
                      h.td([], [due]),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
      h.section(
        [],
        [
          h.h4([], ['Exit criteria']),
          h.ul(
            [h.Class('board-review-checks')],
            pdr.exit.map(item => h.keyed('li')(item, [], ['○ ', item])),
          ),
        ],
      ),
    ],
  )

export const boardReview = (model: Model, tab: BoardReviewTab, h: H): Html =>
  h.div(
    [h.Class('board-review')],
    [
      h.div(
        [h.Class('board-review-head')],
        [
          h.div(
            [],
            [
              h.p([h.Class('eyebrow')], ['Electrical engineer review']),
              h.h2(
                [h.Id('modal-title')],
                ['MW-MPA-48 power board: Rev A → Rev B'],
              ),
            ],
          ),
          ...jiraHandoffs(model.workspace.requirements, model.twinProposal).map(
            ticket => jiraChip(ticket, h),
          ),
        ],
      ),
      h.div(
        [
          h.Class('segmented run-view-toggle board-review-tabs'),
          h.Role('tablist'),
        ],
        BoardReviewTab.literals.map(item =>
          h.keyed('button')(
            item,
            [
              h.Type('button'),
              h.Role('tab'),
              h.AriaSelected(item === tab),
              h.Class(item === tab ? 'active' : ''),
              h.OnClick(Message.SelectedBoardReviewTab({ tab: item })),
            ],
            [item],
          ),
        ),
      ),
      tab === 'PDR'
        ? pdrTab(model, h)
        : tab === 'Schematic'
          ? schematicTab(model, h)
          : tab === 'Electrical'
            ? electricalTab(model, h)
            : tab === '3D model'
              ? modelTab(h)
              : thermalTab(h),
      isApprovedReview(model)
        ? h.div(
            [h.Class('board-review-foot')],
            [
              h.span([h.Class('badge positive')], ['Approved']),
              h.p(
                [h.Class('muted small')],
                [
                  [
                    `Approved by ${proposalReviewer.name}, ${proposalReviewer.role}`,
                    ...approvalTime(model).map(at =>
                      activityTimeFormat.format(at),
                    ),
                  ].join(' · '),
                  '. Read only.',
                ],
              ),
            ],
          )
        : h.div(
            [h.Class('board-review-foot')],
            [
              h.p(
                [h.Class('muted small')],
                [
                  `Signing as ${proposalReviewer.name}, ${proposalReviewer.role}. Rev A stays installed until you approve.`,
                ],
              ),
              h.button(
                [
                  h.Type('button'),
                  h.Class('button outline'),
                  h.OnClick(Message.ClickedRejectTwinProposal()),
                ],
                ['Reject'],
              ),
              h.button(
                [
                  h.Type('button'),
                  h.Class('button primary'),
                  h.OnClick(Message.ClickedApproveTwinProposal()),
                ],
                [
                  isEngineerDesign(model.twinDesign)
                    ? 'Approve edited Rev B and install'
                    : 'Approve and install Rev B',
                ],
              ),
            ],
          ),
    ],
  )
