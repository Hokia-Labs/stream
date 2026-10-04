import { Option, Schema } from 'effect'
import { CustomElement } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import {
  type Requirement,
  TwinFocus,
  TwinOverlay,
  type TwinReviewItem,
  TwinRevision,
} from './domain'
import type { Model } from './main'
import { Message } from './message'
import { pageHeading } from './title-block'
import {
  affectedSubsystems,
  analysisRows,
  hasTwinScenario,
  limitLabel,
  twinChanges,
  twinRevision,
  withinLimit,
} from './twin'

type H = HtmlBuilder<Message>

const twinSpec = CustomElement.define({
  tag: 'stream-twin',
  properties: {
    twinFocus: TwinFocus,
    twinOverlay: TwinOverlay,
    twinRevision: TwinRevision,
  },
  events: {
    'twin-pick': Schema.Struct({ part: Schema.String }),
  },
})

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

const reviewBox = (
  model: Model,
  item: TwinReviewItem,
  label: string,
  isEnabled: boolean,
  h: H,
): Html =>
  h.label(
    [h.Class(`twin-review ${model.twinReviewed.includes(item) ? 'done' : ''}`)],
    [
      h.input([
        h.Type('checkbox'),
        h.Checked(model.twinReviewed.includes(item)),
        h.Disabled(!isEnabled),
        h.OnChange(() => Message.ToggledTwinReview({ item })),
      ]),
      label,
    ],
  )

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

const arrowIcon = (h: HtmlBuilder<Message>): Html =>
  h.span([
    h.Class('icon'),
    h.AriaHidden(true),
    h.InnerHTML(
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
    ),
  ])

export const twinPage = (model: Model, h: H): Html => {
  const twin = twinSpec.withMessage(h)
  const requirements = model.workspace.requirements
  const isLoaded = hasTwinScenario(requirements)
  const revision = twinRevision(requirements)
  const changes = twinChanges(requirements)
  const subsystems = affectedSubsystems(changes)
  const isRevB = revision === 'B'
  const isReviewed = model.twinReviewed.length === 3
  const pkg = model.maybeTwinPackage
  const isSent = Option.exists(pkg, item => item.isSent)
  const steps: ReadonlyArray<Readonly<{ label: string; done: boolean }>> = [
    {
      label: 'Inspect the aft bay',
      done: model.twinFocus === 'Aft bay' || isRevB,
    },
    { label: 'Place PSU Rev B in the systems model', done: isRevB },
    {
      label: 'Review requirement changes',
      done: model.twinReviewed.includes('Requirements'),
    },
    {
      label: 'Review thermal & mechanics',
      done:
        model.twinReviewed.includes('Thermal') &&
        model.twinReviewed.includes('Mechanical'),
    },
    { label: 'Package the DO-254 data', done: Option.isSome(pkg) },
    { label: 'Send to customer', done: isSent },
  ]
  const action = !isLoaded
    ? h.button(
        [
          h.Type('button'),
          h.Class('button primary'),
          h.OnClick(Message.ClickedLoadTwinScenario()),
        ],
        [plusIcon(h), 'Load F-35 PSU scenario'],
      )
    : !isRevB
      ? h.button(
          [
            h.Type('button'),
            h.Class('button primary'),
            h.OnClick(Message.ClickedInstallTwinRevision({ revision: 'B' })),
          ],
          [arrowIcon(h), 'Place PSU Rev B'],
        )
      : h.button(
          [
            h.Type('button'),
            h.Class('button primary'),
            h.Disabled(!isReviewed || model.isGeneratingTwinPackage),
            h.Title(
              isReviewed
                ? 'Generate DO-254 package'
                : 'Review the impact to generate',
            ),
            h.OnClick(Message.ClickedGenerateTwinPackage()),
          ],
          [
            model.isGeneratingTwinPackage
              ? 'Packaging…'
              : 'Generate DO-254 package',
          ],
        )
  return h.div(
    [h.Class('twin-page')],
    [
      pageHeading(
        'Digital twin',
        'Inspect the hardware, place a change in the systems model, review its impact, and package the updated DO-254 data.',
        action,
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
                        ['Airframe', 'Aft bay'] as const,
                        model.twinFocus,
                        focus => Message.SelectedTwinFocus({ focus }),
                        h,
                      ),
                      segmented(
                        'Overlay',
                        ['Shaded', 'Thermal'] as const,
                        model.twinOverlay,
                        overlay => Message.SelectedTwinOverlay({ overlay }),
                        h,
                      ),
                      h.span([h.Class('chip mono')], [`PSU Rev ${revision}`]),
                    ],
                  ),
                  twin([
                    h.Class('twin-canvas'),
                    h.AriaLabel(
                      '3D model of the F-35 with the aft power supply unit',
                    ),
                    twin.TwinFocus(model.twinFocus),
                    twin.TwinOverlay(model.twinOverlay),
                    twin.TwinRevision(revision),
                    twin.OnTwinPick(detail =>
                      Message.ClickedTwinPart({ part: detail.part }),
                    ),
                  ]),
                  model.twinOverlay === 'Thermal'
                    ? h.div(
                        [h.Class('twin-legend')],
                        [
                          h.span([], ['40 °C']),
                          h.span([h.Class('twin-ramp')], []),
                          h.span([], ['95 °C · SAMPLE']),
                        ],
                      )
                    : h.empty,
                  h.p(
                    [h.Class('muted small-text twin-note')],
                    [
                      'Airframe: supplied F-35 model. PSU geometry is a placeholder until the supplier models arrive.',
                    ],
                  ),
                ],
              ),
              h.aside(
                [h.Class('panel twin-side')],
                [
                  h.h2([h.Class('twin-heading')], ['Change workflow']),
                  h.ol(
                    [h.Class('twin-steps')],
                    steps.map((step, index) =>
                      h.keyed('li')(
                        step.label,
                        [h.Class(step.done ? 'done' : '')],
                        [
                          h.span(
                            [h.Class('twin-step-index mono')],
                            [step.done ? '✓' : String(index + 1)],
                          ),
                          step.label,
                        ],
                      ),
                    ),
                  ),
                  h.h2([h.Class('twin-heading')], ['Hardware']),
                  h.dl(
                    [h.Class('twin-facts')],
                    [
                      h.dt([], ['Installed']),
                      h.dd(
                        [],
                        [
                          requirements.find(item => item.id === 'DES-PSU')
                            ?.description ?? '',
                        ],
                      ),
                    ],
                  ),
                  isRevB
                    ? h.button(
                        [
                          h.Type('button'),
                          h.Class('button outline small'),
                          h.OnClick(
                            Message.ClickedInstallTwinRevision({
                              revision: 'A',
                            }),
                          ),
                        ],
                        ['Revert to Rev A'],
                      )
                    : h.button(
                        [
                          h.Type('button'),
                          h.Class('button primary small'),
                          h.OnClick(
                            Message.ClickedInstallTwinRevision({
                              revision: 'B',
                            }),
                          ),
                        ],
                        ['Place PSU Rev B in the systems model'],
                      ),
                  h.h2([h.Class('twin-heading')], ['Affected subsystems']),
                  subsystems.length === 0
                    ? h.p(
                        [h.Class('muted small-text')],
                        ['None yet. The model is at the Rev A baseline.'],
                      )
                    : h.ul(
                        [h.Class('twin-subsystems')],
                        subsystems.map(item =>
                          h.keyed('li')(
                            item.name,
                            [],
                            [
                              h.strong([], [item.name]),
                              h.span(
                                [h.Class('mono muted')],
                                [item.ids.join(' · ')],
                              ),
                            ],
                          ),
                        ),
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
                        [`Requirement changes · ${changes.length}`],
                      ),
                      reviewBox(
                        model,
                        'Requirements',
                        'Requirement changes reviewed',
                        isRevB,
                        h,
                      ),
                    ],
                  ),
                  changes.length === 0
                    ? h.p(
                        [h.Class('muted small-text')],
                        ['Place Rev B to see which requirements change.'],
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
                                      h.span(
                                        [h.Class('mono small-text')],
                                        [change.artifact.id],
                                      ),
                                      h.div([], [change.artifact.title]),
                                    ],
                                  ),
                                  h.td([], [change.artifact.subsystem]),
                                  h.td(
                                    [h.Class('twin-before')],
                                    [change.before],
                                  ),
                                  h.td([h.Class('twin-after')], [change.after]),
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
                                          h.Class('button ghost small'),
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
                      h.span(
                        [h.Class('chip mono')],
                        ['SAMPLE · precomputed, not ANSYS output'],
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
                    [h.Class('twin-review-row')],
                    [
                      reviewBox(
                        model,
                        'Thermal',
                        'Thermal results reviewed',
                        isRevB,
                        h,
                      ),
                      reviewBox(
                        model,
                        'Mechanical',
                        'Mechanical results reviewed',
                        isRevB,
                        h,
                      ),
                    ],
                  ),
                ],
              ),
              h.section(
                [h.Class('panel twin-wide')],
                [
                  h.div(
                    [h.Class('twin-section-head')],
                    [h.h2([h.Class('twin-heading')], ['DO-254 data package'])],
                  ),
                  Option.match(pkg, {
                    onNone: () =>
                      h.div(
                        [],
                        [
                          h.p(
                            [h.Class('muted small-text')],
                            [
                              isRevB && isReviewed
                                ? 'Ready. Generates the updated HRD plus DO-254 data (accomplishment summary, configuration index, verification results, change impact analysis, problem reports), traceability, SAMPLE analysis, and a SHA-256 manifest as one zip.'
                                : 'Available after Rev B is placed and all three reviews are checked.',
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
                              h.OnClick(Message.ClickedGenerateTwinPackage()),
                            ],
                            [
                              model.isGeneratingTwinPackage
                                ? 'Packaging…'
                                : 'Generate DO-254 package',
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
                          h.div(
                            [h.Class('twin-package-actions')],
                            [
                              h.button(
                                [
                                  h.Type('button'),
                                  h.Class('button outline'),
                                  h.OnClick(
                                    Message.ClickedGenerateTwinPackage(),
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
