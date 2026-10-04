import { Option, Schema } from 'effect'
import { CustomElement } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import {
  type DiffState,
  type SchematicBlock,
  heatColor,
  heatField,
  heatScale,
  isEngineerDesign,
  pdr,
  pdrItems,
  schematic,
  schematicDiff,
  thermalReport,
  thermalResults,
} from './board-review'
import {
  BoardReviewTab,
  type Requirement,
  type TwinDesignField,
  TwinFocus,
  type TwinReviewItem,
  TwinRevision,
  type TwinSlot,
} from './domain'
import { idLink, linkifyIds } from './id-link'
import type { Model } from './main'
import { Message } from './message'
import { pageHeading } from './title-block'
import {
  affectedSubsystems,
  analysisRows,
  avionicsChange,
  avionicsRequirementIds,
  budgetMargin,
  busDemandKw,
  capacityKw,
  catalogBlocker,
  catalogImpact,
  catalogSpecLabels,
  failureCases,
  hasTwinScenario,
  installedPart,
  isAvionicsUpgraded,
  limitLabel,
  loadBudget,
  lowMargin,
  proposalPartChanges,
  proposalReviewer,
  requirementChecks,
  signoffTitle,
  slotHealth,
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

const rackSpec = CustomElement.define({
  tag: 'stream-rack',
  properties: { rackRevision: TwinRevision },
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

const reportEditor = (model: Model, h: H): Html => {
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
          h.span(
            [h.Class('muted small-text')],
            [
              [
                editedCount > 0
                  ? `${editedCount} edited`
                  : 'Drafts · edit before you download',
                syncLabel[model.twinReportSync],
              ]
                .filter(Boolean)
                .join(' · '),
            ],
          ),
        ],
      ),
      active
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

const badgeClass = (status: Requirement['status']): string =>
  status === 'Verified'
    ? 'badge positive'
    : status === 'Needs review'
      ? 'badge warning'
      : 'badge neutral'

const segmented = <A extends string>(
  label: string,
  options: ReadonlyArray<A>,
  active: A,
  toMessage: (value: A) => Message,
  h: H,
): Html =>
  h.div(
    [
      h.Class('segmented run-view-toggle twin-toggle'),
      h.Role('group'),
      h.AriaLabel(label),
    ],
    options.map(option =>
      h.keyed('button')(
        option,
        [
          h.Type('button'),
          h.Class(option === active ? 'active' : ''),
          h.AriaPressed(String(option === active)),
          h.OnClick(toMessage(option)),
        ],
        [option],
      ),
    ),
  )

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
  h.span([h.Class('twin-signed')], [svgIcon(checkPath, h), 'Ben Juntilla'])

const signoffFooter = (
  model: Model,
  item: TwinReviewItem,
  prompt: string,
  isEnabled: boolean,
  h: H,
): Html =>
  h.div(
    [
      h.Class(
        `twin-signoff-footer ${model.twinReviewed.includes(item) ? 'signed' : isEnabled ? 'pending' : ''}`,
      ),
    ],
    [
      model.twinReviewed.includes(item)
        ? h.span(
            [h.Class('twin-signoff-status')],
            [signatory(h), h.span([], ['signed off'])],
          )
        : h.span(
            [h.Class('twin-signoff-status')],
            [isEnabled ? prompt : 'Place Rev B before signing off.'],
          ),
      signoffButton(model, item, isEnabled, h),
    ],
  )

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
  const remaining = twinSignoffs.length - model.twinReviewed.length
  return h.section(
    [h.Class('panel twin-wide'), h.AriaLabel('Engineering sign-off')],
    [
      h.div(
        [h.Class('twin-section-head')],
        [
          h.h2([h.Class('twin-heading')], ['Sign-off']),
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
                            [h.Class(isRevB ? 'amber-text' : 'muted')],
                            ['Pending'],
                          ),
                    ],
                  ),
                  h.td(
                    [h.Class('twin-signoff-action')],
                    [signoffButton(model, signoff.item, isRevB, h)],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      h.p(
        [h.Class('muted small-text twin-signoff-note')],
        [
          remaining === 0
            ? 'All disciplines signed. DO-254 drafting is available, and sign-offs are recorded in the change record.'
            : `DO-254 drafting is available once all three disciplines sign off. ${remaining} remaining.`,
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

const marginCell = (margin: number, h: H): Html =>
  h.span(
    [
      h.Class(
        `mono twin-margin ${margin < 0 ? 'bad' : margin < avionicsChange.requiredMargin ? 'low' : 'ok'}`,
      ),
    ],
    [percent(margin)],
  )

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
          h.span(
            [],
            [
              h.strong([], [`${kw(demand)} kW`]),
              isUpgraded ? ' demand with new avionics' : ' demand today',
            ],
          ),
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
          h.span(
            [],
            [`Rev ${revision} with one module failed: ${kw(capacity)} kW`],
          ),
          h.span([], [`${kw(scale)} kW`]),
        ],
      ),
    ],
  )
}

const changeDriver = (
  model: Model,
  isRevB: boolean,
  isUpgraded: boolean,
  h: H,
): Html => {
  const rows = loadBudget()
  return h.section(
    [h.Class('panel twin-wide'), h.AriaLabel('Change driver')],
    [
      h.div(
        [h.Class('twin-section-head')],
        [
          h.h2(
            [h.Class('twin-heading')],
            [`Why the power assembly is changing · ${avionicsChange.id}`],
          ),
          h.span(
            [
              h.Class(
                `small-text ${isRevB || !isUpgraded ? 'twin-margin ok' : 'twin-margin bad'}`,
              ),
            ],
            [
              isRevB
                ? 'Rev B carries the new avionics with a module failed'
                : isUpgraded
                  ? 'Rev A can’t carry the new avionics if a module fails'
                  : 'Rev A has margin with one module failed',
            ],
          ),
        ],
      ),
      capacityBar(isRevB, isUpgraded, h),
      h.details(
        [h.Class('twin-details')],
        [
          h.summary([], ['Engineering details']),
          h.p(
            [h.Class('twin-driver-summary')],
            [
              h.strong([], [`${avionicsChange.title}. `]),
              avionicsChange.summary,
            ],
          ),
          h.div(
            [h.Class('twin-driver')],
            [
              h.div(
                [],
                [
                  h.h3([h.Class('twin-subheading')], ['New module load sheet']),
                  h.dl(
                    [h.Class('twin-facts')],
                    avionicsChange.loadSheet.flatMap(([label, value]) => [
                      h.dt([], [label]),
                      h.dd([], [value]),
                    ]),
                  ),
                ],
              ),
              h.div(
                [],
                [
                  h.h3(
                    [h.Class('twin-subheading')],
                    [
                      `Budget (demand / limit) at ${kw(busDemandKw)} kW bus load`,
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
                              'Check',
                              'Req.',
                              'Rev A',
                              'Margin',
                              'Rev B',
                              'Margin',
                            ].map(label => h.th([], [label])),
                          ),
                        ],
                      ),
                      h.tbody(
                        [],
                        rows.map(row =>
                          h.keyed('tr')(
                            row.check,
                            [],
                            [
                              h.td([], [row.check]),
                              h.td(
                                [],
                                [
                                  idLink(
                                    model,
                                    row.traceId,
                                    h,
                                    'mono small-text',
                                  ),
                                ],
                              ),
                              h.td(
                                [h.Class('mono nowrap')],
                                [
                                  `${kw(row.demand.A)} / ${kw(row.capacity.A)} ${row.unit}`,
                                ],
                              ),
                              h.td([], [marginCell(budgetMargin(row, 'A'), h)]),
                              h.td(
                                [h.Class('mono nowrap')],
                                [
                                  `${kw(row.demand.B)} / ${kw(row.capacity.B)} ${row.unit}`,
                                ],
                              ),
                              h.td([], [marginCell(budgetMargin(row, 'B'), h)]),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                  h.p(
                    [h.Class('muted small-text twin-driver-note')],
                    [
                      `Demand = ${avionicsChange.existingLoadKw} − ${avionicsChange.replacedKw} + ${avionicsChange.steadyKw} = ${kw(busDemandKw)} kW. N−1 capacity = (modules − 1) × ${avionicsChange.moduleRatingKw} kW; peak limit = ${avionicsChange.shortTermRating}× N−1. Heat = P × (1/η − 1), η = ${avionicsChange.efficiency}. Drop = I × R, I = ${avionicsChange.steadyKw * 1000} W / ${avionicsChange.busVolts} V. Margin = (limit − demand) / limit; design rule ≥ ${avionicsChange.requiredMargin * 100}%.`,
                    ],
                  ),
                ],
              ),
            ],
          ),
          h.h3([h.Class('twin-subheading')], ['Failure cases']),
          h.table(
            [h.Class('twin-table twin-failures')],
            [
              h.thead(
                [],
                [
                  h.tr(
                    [],
                    ['Failure', 'Rev A', 'Rev B'].map(label =>
                      h.th([], [label]),
                    ),
                  ),
                ],
              ),
              h.tbody(
                [],
                failureCases.map(item =>
                  h.keyed('tr')(
                    item.failure,
                    [],
                    [
                      h.td([], [item.failure]),
                      h.td(
                        [h.Class(item.isShortA ? 'twin-margin bad' : '')],
                        [item.effect.A],
                      ),
                      h.td(
                        [h.Class(item.isShortA ? 'twin-margin ok' : '')],
                        [item.effect.B],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
      h.p(
        [h.Class('muted small-text')],
        [
          'The F-35 is motivation only; nothing here claims F-35 compatibility or qualification.',
        ],
      ),
    ],
  )
}

const slotName = (slot: TwinSlot): string =>
  slot === 'Cockpit' ? 'Cockpit avionics' : 'Aft power assembly'

const slotCard = (model: Model, slot: TwinSlot, h: H): Html => {
  const requirements = model.workspace.requirements
  const part = installedPart(requirements, slot)
  const health = slotHealth(requirements, slot)
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
        [h.Class('twin-slot-part')],
        [h.span([h.Class('mono')], [`${part.id} · Rev ${part.revision}`])],
      ),
      h.p([h.Class('twin-slot-title')], [part.title]),
      h.p([h.Class(`twin-slot-health ${health.tone}`)], [health.text]),
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

const workflowSteps = (stage: number, canReset: boolean, h: H): Html =>
  h.div(
    [h.Class('twin-steps-row')],
    [
      h.ol(
        [h.Class('twin-steps')],
        [
          'Swap avionics',
          'Requirements revised',
          'Agent proposes Rev B',
          'EE approval',
          'Re-verify',
        ].map((label, index) =>
          h.keyed('li')(
            label,
            [
              h.Class(
                `twin-step ${index < stage ? 'done' : index === stage ? 'current' : ''}`,
              ),
            ],
            [h.span([h.Class('twin-step-index')], [String(index + 1)]), label],
          ),
        ),
      ),
      h.button(
        [
          h.Type('button'),
          h.Class('button outline small twin-reset'),
          h.Disabled(!canReset),
          h.Title('Put back the original avionics and power assembly Rev A'),
          h.OnClick(Message.ClickedResetTwin()),
        ],
        ['Reset'],
      ),
    ],
  )

const proposalPanel = (
  model: Model,
  isUpgraded: boolean,
  isRevB: boolean,
  h: H,
): Html => {
  const proposal = model.twinProposal
  const reviewer = `${proposalReviewer.name} · ${proposalReviewer.role}`
  const rows = loadBudget()
  const head = h.div(
    [h.Class('twin-section-head')],
    [
      h.h2([h.Class('twin-heading')], ['Power board redesign · MPA Rev B']),
      isRevB
        ? h.span([h.Class('badge positive')], ['Approved · installed'])
        : proposal === 'Pending'
          ? h.span([h.Class('badge warning')], ['Awaiting EE approval'])
          : proposal === 'Rejected'
            ? h.span([h.Class('badge danger')], ['Rejected'])
            : h.empty,
    ],
  )
  const body = !isUpgraded
    ? [
        h.p(
          [h.Class('muted small-text')],
          [
            'Swap in the new cockpit avionics first. Its revised requirements drive the power board redesign.',
          ],
        ),
      ]
    : !isRevB && (proposal === 'None' || proposal === 'Approved')
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
                `Power agent is checking ${avionicsRequirementIds.length} revised requirements against MW-MPA-48-4 Rev A and drafting part changes…`,
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
                '. Rev A gives 9.0 kW with one module failed; the revised load is 10.2 kW.',
              ],
            ),
            h.table(
              [h.Class('twin-table twin-proposal-table')],
              [
                h.thead(
                  [],
                  [
                    h.tr(
                      [],
                      ['Part', 'Rev A', 'Proposed Rev B', 'Driven by'].map(
                        label => h.th([], [label]),
                      ),
                    ),
                  ],
                ),
                h.tbody(
                  [],
                  proposalPartChanges.map(change =>
                    h.keyed('tr')(
                      change.part,
                      [],
                      [
                        h.td([], [change.part]),
                        h.td([h.Class('twin-before')], [change.before]),
                        h.td([h.Class('twin-after')], [change.after]),
                        h.td([], [idLink(model, change.trace, h, 'mono')]),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            h.ul(
              [h.Class('twin-predicted')],
              [rows[1], rows[3], rows[4]].flatMap(row =>
                row
                  ? [
                      h.keyed('li')(
                        row.check,
                        [],
                        [
                          h.span([], [row.check]),
                          h.span(
                            [h.Class('mono twin-margin bad')],
                            [
                              `${row.demand.A.toFixed(2)} / ${row.capacity.A.toFixed(2)} ${row.unit}`,
                            ],
                          ),
                          '→',
                          h.span(
                            [h.Class('mono twin-margin ok')],
                            [
                              `${row.demand.B.toFixed(2)} / ${row.capacity.B.toFixed(2)} ${row.unit}`,
                            ],
                          ),
                        ],
                      ),
                    ]
                  : [],
              ),
            ),
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
                        [],
                        [
                          h.strong([], ['Electrical engineer review · ']),
                          `${reviewer}. Nothing changes in the twin until this is approved.`,
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
      h.h2([h.Class('twin-heading')], ['Requirement check · Rev B']),
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
    return h.section(
      [h.Class('panel twin-wide')],
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
                  [
                    'Rev B is installed. Check every revised requirement against it and find what needs re-verifying.',
                  ],
                ),
                h.button(
                  [
                    h.Type('button'),
                    h.Class('button primary small'),
                    h.OnClick(Message.ClickedRunTwinCheck()),
                  ],
                  ['Check requirements against Rev B'],
                ),
              ],
            ),
      ],
    )
  }
  return h.section(
    [h.Class('panel twin-wide'), h.AriaLabel('Requirement check')],
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
          ` · ${queue.length} artifacts need re-verification before ECP-0219 closes`,
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

export const twinPage = (model: Model, h: H): Html => {
  const twin = twinSpec.withMessage(h)
  const requirements = model.workspace.requirements
  const isLoaded = hasTwinScenario(requirements)
  const revision = twinRevision(requirements)
  const changes = twinChanges(requirements)
  const subsystems = affectedSubsystems(changes)
  const isRevB = revision === 'B'
  const isUpgraded = isAvionicsUpgraded(requirements)
  const isReviewed = model.twinReviewed.length === 3
  const pkg = model.maybeTwinPackage
  const hasReports = model.twinReports.length > 0
  const proposal = model.twinProposal
  const stage = !isUpgraded
    ? 0
    : !isRevB
      ? proposal === 'Pending' || proposal === 'Rejected'
        ? 3
        : 2
      : model.twinCheck === 'Done'
        ? 5
        : 4
  return h.div(
    [h.Class('twin-page')],
    [
      pageHeading(
        'Digital twin',
        'Inspect the hardware, place a change in the systems model, review its impact, and package the updated DO-254 data.',
        isLoaded
          ? h.empty
          : h.button(
              [
                h.Type('button'),
                h.Class('button primary'),
                h.OnClick(Message.ClickedLoadTwinScenario()),
              ],
              [plusIcon(h), 'Load F-35 power scenario'],
            ),
        h,
      ),
      !isLoaded
        ? emptyState(h)
        : h.div(
            [h.Class('twin-layout')],
            [
              h.section(
                [h.Class('panel twin-stage')],
                [
                  h.div(
                    [h.Class('twin-toolbar')],
                    [
                      segmented(
                        'Camera',
                        ['Airframe', 'Aft bay', 'Cockpit'] as const,
                        model.twinFocus,
                        focus => Message.SelectedTwinFocus({ focus }),
                        h,
                      ),
                    ],
                  ),
                  twin([
                    h.Class('twin-canvas'),
                    h.AriaLabel(
                      '3D model of the F-35 with the aft modular power assembly and the new cockpit avionics module',
                    ),
                    twin.TwinFocus(model.twinFocus),
                    twin.TwinRevision(revision),
                    twin.TwinAvionicsUpgraded(isUpgraded),
                    twin.OnTwinPick(detail =>
                      Message.ClickedTwinPart({ part: detail.part }),
                    ),
                  ]),
                  h.div(
                    [h.Class('twin-legend')],
                    [
                      h.span([], ['40 °C']),
                      h.span([h.Class('twin-ramp')], []),
                      h.span([], ['95 °C']),
                    ],
                  ),
                  h.p(
                    [h.Class('muted small-text twin-note')],
                    [
                      'Airframe: supplied F-35 model. Power assembly and avionics geometry are placeholders until the supplier models arrive.',
                    ],
                  ),
                ],
              ),
              h.aside(
                [h.Class('panel twin-side')],
                [
                  h.h2([h.Class('twin-heading')], ['Installed hardware']),
                  slotCard(model, 'Cockpit', h),
                  slotCard(model, 'Power', h),
                  h.h2([h.Class('twin-heading')], ['Changed artifacts']),
                  changes.length === 0
                    ? h.p(
                        [h.Class('muted small-text')],
                        ['None. Baseline configuration.'],
                      )
                    : h.p(
                        [h.Class('twin-changed')],
                        changes.flatMap((change, index) => [
                          ...(index > 0 ? [' · '] : []),
                          idLink(model, change.artifact.id, h, 'mono'),
                        ]),
                      ),
                ],
              ),
              h.div(
                [h.Class('twin-wide')],
                [workflowSteps(stage, isUpgraded, h)],
              ),
              changeDriver(model, isRevB, isUpgraded, h),
              proposalPanel(model, isUpgraded, isRevB, h),
              isRevB ? checkPanel(model, h) : h.empty,
              h.section(
                [h.Class('panel twin-wide')],
                [
                  h.div(
                    [h.Class('twin-section-head')],
                    [
                      h.h2(
                        [h.Class('twin-heading')],
                        [`Requirement changes · ${changes.length}`],
                      ),
                    ],
                  ),
                  changes.length === 0
                    ? h.p(
                        [h.Class('muted small-text')],
                        [
                          'Swap in the new avionics to see which requirements change.',
                        ],
                      )
                    : h.table(
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
                                  'Before (Rev A)',
                                  'After',
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
                                      idLink(
                                        model,
                                        change.artifact.id,
                                        h,
                                        'mono small-text',
                                      ),
                                      h.div([], [change.artifact.title]),
                                    ],
                                  ),
                                  h.td([], [change.artifact.subsystem]),
                                  h.td(
                                    [h.Class('twin-before')],
                                    linkifyIds(model, change.before, h),
                                  ),
                                  h.td(
                                    [h.Class('twin-after')],
                                    linkifyIds(model, change.after, h),
                                  ),
                                  h.td(
                                    [],
                                    [
                                      h.span(
                                        [h.Class(badgeClass(change.status))],
                                        [change.status],
                                      ),
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
                      ),
                  signoffFooter(
                    model,
                    'Requirements',
                    `Reviewed the ${changes.length} requirement changes above?`,
                    isRevB,
                    h,
                  ),
                ],
              ),
              h.section(
                [h.Class('panel twin-wide')],
                [
                  h.div(
                    [h.Class('twin-section-head')],
                    [
                      h.h2(
                        [h.Class('twin-heading')],
                        ['Thermal & mechanical analysis'],
                      ),
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
                              'Metric',
                              'Domain',
                              'Rev A',
                              'Rev B',
                              'Limit',
                              'Result',
                            ].map(label => h.th([], [label])),
                          ),
                        ],
                      ),
                      h.tbody(
                        [],
                        analysisRows.map(row =>
                          h.keyed('tr')(
                            row.metric,
                            [],
                            [
                              h.td([], [row.metric]),
                              h.td([h.Class('muted')], [row.domain]),
                              h.td(
                                [h.Class('mono')],
                                [`${row.revA} ${row.unit}`],
                              ),
                              h.td(
                                [h.Class(`mono ${isRevB ? 'twin-after' : ''}`)],
                                [`${row.revB} ${row.unit}`],
                              ),
                              h.td([h.Class('mono')], [limitLabel(row)]),
                              h.td(
                                [],
                                [
                                  h.span(
                                    [
                                      h.Class(
                                        withinLimit(row, row.revB)
                                          ? 'badge positive'
                                          : 'badge warning',
                                      ),
                                    ],
                                    [
                                      withinLimit(row, row.revB)
                                        ? 'Within limit'
                                        : 'Exceeds',
                                    ],
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                  h.div(
                    [h.Class('twin-signoff-footers')],
                    [
                      signoffFooter(
                        model,
                        'Thermal',
                        'Reviewed the thermal results?',
                        isRevB,
                        h,
                      ),
                      signoffFooter(
                        model,
                        'Mechanical',
                        'Reviewed the mechanical results?',
                        isRevB,
                        h,
                      ),
                    ],
                  ),
                ],
              ),
              signoffGate(model, isRevB, changes.length, subsystems.length, h),
              h.section(
                [h.Class('panel twin-wide')],
                [
                  h.div(
                    [h.Class('twin-section-head')],
                    [h.h2([h.Class('twin-heading')], ['DO-254 data package'])],
                  ),
                  Option.match(pkg, {
                    onNone: () =>
                      hasReports
                        ? h.div(
                            [],
                            [
                              reportEditor(model, h),
                              h.div(
                                [h.Class('twin-package-actions')],
                                [
                                  h.button(
                                    [
                                      h.Type('button'),
                                      h.Class('button primary'),
                                      h.Disabled(model.isGeneratingTwinPackage),
                                      h.OnClick(
                                        Message.ClickedDownloadTwinPackage(),
                                      ),
                                    ],
                                    [
                                      model.isGeneratingTwinPackage
                                        ? 'Packaging…'
                                        : 'Download DO-254 package',
                                    ],
                                  ),
                                ],
                              ),
                            ],
                          )
                        : h.div(
                            [],
                            [
                              h.p(
                                [h.Class('muted small-text')],
                                [
                                  isRevB && isReviewed
                                    ? 'Ready. Drafts the updated HRD and DO-254 data (accomplishment summary, configuration index, verification results, change impact analysis, problem reports) for you to review and edit, then packages them with traceability, analysis results, and a SHA-256 manifest as one zip.'
                                    : 'Available after Rev B is placed and all three sign-offs are in.',
                                ],
                              ),
                              h.button(
                                [
                                  h.Type('button'),
                                  h.Class('button primary'),
                                  h.Disabled(
                                    !isRevB ||
                                      !isReviewed ||
                                      model.isGeneratingTwinPackage,
                                  ),
                                  h.OnClick(
                                    Message.ClickedGenerateTwinPackage(),
                                  ),
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
                          h.dl(
                            [h.Class('twin-facts')],
                            [
                              h.dt([], ['Package']),
                              h.dd([h.Class('mono')], [item.name]),
                              h.dt([], ['Size']),
                              h.dd(
                                [h.Class('mono')],
                                [`${(item.bytes / 1024).toFixed(1)} KB`],
                              ),
                              h.dt([], ['SHA-256']),
                              h.dd(
                                [h.Class('mono')],
                                [item.digest.slice(0, 16) + '…'],
                              ),
                              h.dt([], ['Files']),
                              h.dd([h.Class('mono')], [item.files.join(' · ')]),
                            ],
                          ),
                          reportEditor(model, h),
                          h.div(
                            [h.Class('twin-package-actions')],
                            [
                              h.button(
                                [
                                  h.Type('button'),
                                  h.Class('button outline'),
                                  h.OnClick(
                                    Message.ClickedDownloadTwinPackage(),
                                  ),
                                ],
                                ['Download again'],
                              ),
                              item.isSent
                                ? h.span(
                                    [h.Class('badge positive')],
                                    ['Sent to customer'],
                                  )
                                : h.button(
                                    [
                                      h.Type('button'),
                                      h.Class('button primary'),
                                      h.OnClick(
                                        Message.ClickedMarkTwinPackageSent(),
                                      ),
                                    ],
                                    ['Mark as sent to customer'],
                                  ),
                            ],
                          ),
                          h.p(
                            [h.Class('muted small-text')],
                            [
                              'Stream does not email the customer. Send the zip through your usual channel, then mark it as sent.',
                            ],
                          ),
                        ],
                      ),
                  }),
                ],
              ),
            ],
          ),
    ],
  )
}

const diffClass = (state: DiffState): string => `diff-${state.toLowerCase()}`

const schematicBlock = (
  block: SchematicBlock,
  x: number,
  y: number,
  width: number,
  h: H,
): Html =>
  h.keyed('g')(
    block.id,
    [h.Class(`schematic-block ${diffClass(block.state)}`)],
    [
      h.rect([
        h.X(String(x)),
        h.Y(String(y)),
        h.Width(String(width)),
        h.Height('40'),
      ]),
      h.text(
        [h.X(String(x + 8)), h.Y(String(y + 16)), h.Class('schematic-ref')],
        [block.ref],
      ),
      h.text(
        [h.X(String(x + 8)), h.Y(String(y + 31)), h.Class('schematic-value')],
        [block.value],
      ),
    ],
  )

const wire = (d: string, h: H): Html =>
  h.path([h.D(d), h.Class('schematic-wire')])

const schematicSheet = (
  revision: 'A' | 'B',
  design: Model['twinDesign'],
  h: H,
): Html => {
  const sheet = schematic(revision, design)
  const rowGap = 48
  const top = 40
  const height = Math.max(
    top + sheet.modules.length * rowGap + 20,
    top + sheet.outputs.length * rowGap + 20,
  )
  const busX = 300
  return h.figure(
    [h.Class('schematic-sheet')],
    [
      h.figcaption(
        [],
        [revision === 'A' ? 'Rev A · released' : 'Rev B · proposed'],
      ),
      h.svg(
        [
          h.ViewBox(`0 0 560 ${height}`),
          h.Role('img'),
          h.AriaLabel(`Power board schematic, Rev ${revision}`),
        ],
        [
          h.text(
            [h.X('8'), h.Y('20'), h.Class('schematic-net')],
            ['270 VDC A/B'],
          ),
          h.text(
            [h.X(String(busX - 30)), h.Y('20'), h.Class('schematic-net')],
            ['48 V bus'],
          ),
          wire(`M 92 30 V ${height - 16}`, h),
          wire(`M ${busX} 30 V ${height - 16}`, h),
          ...sheet.modules.flatMap((block, index) => {
            const y = top + index * rowGap
            return [
              wire(`M 92 ${y + 20} H 120 M 250 ${y + 20} H ${busX}`, h),
              schematicBlock(block, 120, y, 130, h),
            ]
          }),
          ...sheet.outputs.flatMap((block, index) => {
            const y = top + index * rowGap
            return [
              wire(`M ${busX} ${y + 20} H 330`, h),
              schematicBlock(block, 330, y, 220, h),
            ]
          }),
        ],
      ),
    ],
  )
}

const diffBadge = (state: DiffState, h: H): Html =>
  h.span([h.Class(`badge ${diffClass(state)}`)], [state])

const schematicTab = (model: Model, h: H): Html =>
  h.div(
    [h.Class('board-review-body')],
    [
      h.div(
        [h.Class('board-review-pair')],
        [
          schematicSheet('A', model.twinDesign, h),
          schematicSheet('B', model.twinDesign, h),
        ],
      ),
      h.ul(
        [h.Class('schematic-legend')],
        (['Added', 'Changed', 'Removed'] as const).map(state =>
          h.keyed('li')(state, [h.Class(diffClass(state))], [state]),
        ),
      ),
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
  const rack = rackSpec.withMessage(h)
  return h.div(
    [h.Class('board-review-body')],
    [
      h.div(
        [h.Class('board-review-pair')],
        (['A', 'B'] as const).map(revision =>
          h.keyed('figure')(
            revision,
            [h.Class('board-review-3d')],
            [
              h.figcaption(
                [],
                [
                  revision === 'A'
                    ? 'Rev A · 4 modules, single cold plate'
                    : 'Rev B · 5 modules, dual cold plate, added module outlined',
                ],
              ),
              rack([
                h.Class('board-review-canvas'),
                h.AriaLabel(`3D model of the power assembly, Rev ${revision}`),
                rack.RackRevision(revision),
              ]),
            ],
          ),
        ),
      ),
      h.p(
        [h.Class('muted small')],
        [
          'Drag to orbit. One module is shown failed (dark), the N−1 case. Colours use the thermal scale.',
        ],
      ),
    ],
  )
}

const heatColumns = 24
const heatRows = 12

const heatMap = (revision: 'A' | 'B', h: H): Html =>
  h.figure(
    [h.Class('heat-map')],
    [
      h.figcaption([], [`Rev ${revision} · module board, worst module, N−1`]),
      h.div(
        [
          h.Class('heat-grid'),
          h.Role('img'),
          h.AriaLabel(`Temperature contour, Rev ${revision}`),
        ],
        heatField(revision, heatColumns, heatRows).map((temperature, index) =>
          h.keyed('span')(
            String(index),
            [h.Style({ background: heatColor(temperature) })],
            [],
          ),
        ),
      ),
    ],
  )

const thermalTab = (h: H): Html =>
  h.div(
    [h.Class('board-review-body')],
    [
      h.div([h.Class('board-review-pair')], [heatMap('A', h), heatMap('B', h)]),
      h.div(
        [h.Class('heat-legend')],
        [
          h.span([], [`${heatScale.min} °C`]),
          h.span([h.Class('heat-legend-bar')], []),
          h.span([], [`${heatScale.max} °C · same scale both revisions`]),
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
                    [h.Class(row.a > row.limit ? 'diff-removed' : '')],
                    [`${row.a.toFixed(1)} °C`],
                  ),
                  h.td(
                    [h.Class(row.b > row.limit ? 'diff-removed' : '')],
                    [`${row.b.toFixed(1)} °C`],
                  ),
                  h.td([], [`≤ ${row.limit} °C`]),
                  h.td([], [`${(row.limit - row.b).toFixed(1)} °C`]),
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
                          h.OnInput(value =>
                            Message.UpdatedTwinDesign({ index, field, value }),
                          ),
                        ]),
                      ],
                    ),
                  ),
                  h.td(
                    [],
                    [
                      h.button(
                        [
                          h.Type('button'),
                          h.Class('button ghost small'),
                          h.AriaLabel(`Remove row ${index + 1}`),
                          h.OnClick(
                            Message.ClickedRemoveTwinDesignChange({ index }),
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
      h.div(
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
      h.label(
        [h.Class('board-review-upload')],
        [
          h.span([], ['Upload your own PDR']),
          h.span([h.Class('muted small')], ['PDF, Word, Markdown or text']),
          h.input([
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
              h.button(
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
      pdrUpload(model, h),
      h.p(
        [h.Class('board-review-source')],
        [
          h.strong([], [`${pdr.id} · `]),
          isEngineerDesign(model.twinDesign)
            ? 'Design edited by the engineer. Items that differ from the agent are marked.'
            : 'Prepared by the power agent.',
          ...Option.match(model.maybeTwinPdr, {
            onNone: () => [],
            onSome: upload => [
              ` Your PDR ${upload.name} is attached alongside it.`,
            ],
          }),
        ],
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
            [h.Class('table board-review-table')],
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
                      h.td([], [id]),
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
        [h.h4([], ['Recommendation']), h.p([], [pdr.recommendation])],
      ),
      h.section(
        [],
        [
          h.h4([], ['Exit criteria']),
          h.ul(
            [],
            pdr.exit.map(item => h.keyed('li')(item, [], [item])),
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
              h.p(
                [h.Class('eyebrow')],
                ['ECP-0219 · electrical engineer review'],
              ),
              h.h2(
                [h.Id('modal-title')],
                ['MW-MPA-48 power board: Rev A → Rev B'],
              ),
            ],
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
          : tab === '3D model'
            ? modelTab(h)
            : thermalTab(h),
      h.div(
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
