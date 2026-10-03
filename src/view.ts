import { Array, Option, Order } from 'effect'
import type { Document, Html, HtmlBuilder } from 'foldkit/html'
import { modifyFields } from 'foldkit/struct'

import {
  groupArtifacts,
  matchesSavedView,
  visibleArtifacts,
} from './artifact-order'
import {
  artifactReaderView,
  artifactTree,
  artifactTreeView,
  artifactViewSwitcher,
} from './artifact-view'
import { branchesPage } from './branch-view'
import { workingRequirements } from './branches'
import type { Agent, Approval, Page, Run, SortKey, Task } from './domain'
import {
  AgentWave,
  ArtifactField,
  ExecutionMode,
  GraphPreviewTab,
  GroupBy,
  LaunchScope,
  Modal,
  Requirement,
  RunView,
  downstream,
  stageNames,
  validCloudflareAccountId,
  validCloudflareToken,
} from './domain'
import {
  type Level,
  agentWave,
  findingTasks,
  findingText,
  impactCounts,
  launchEstimate,
  launchScopeRequirements,
  runAnnotations,
  runLog,
  runSummary,
  taskAnchor,
} from './insights'
import { sidebarMaxWidth, sidebarMinWidth } from './layout'
import type { Model } from './main'
import {
  type Severity,
  isLongFinding,
  markdownBlocks,
  severityLevel,
  summarizeFinding,
} from './markdown'
import { markdownView } from './markdown-view'
import { Message } from './message'
import { paletteItems } from './palette'
import { pageHeading } from './title-block'
import { twinPage } from './twin-view'

type H = HtmlBuilder<Message>
const paths: Readonly<Record<string, string>> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  graph:
    '<rect x="3" y="9" width="6" height="6" rx="1.5"/><rect x="15" y="3" width="6" height="6" rx="1.5"/><rect x="15" y="15" width="6" height="6" rx="1.5"/><path d="M9 12h3V6h3M12 12v6h3"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  agent:
    '<path d="m12 3 2.8 5.6L21 12l-6.2 3.4L12 21l-2.8-5.6L3 12l6.2-3.4Z"/><path d="m12 8 2 4-2 4-2-4Z"/>',
  play: '<path d="m8 4 13 8-13 8Z"/>',
  plug: '<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0ZM12 17v4"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  alert: '<path d="m12 3 10 18H2Z"/><path d="M12 9v4m0 3v1"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 17l10 5 10-5"/>',
  shield:
    '<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z"/><path d="m8 12 3 3 5-6"/>',
  test: '<path d="M8 3h8M10 3v7l-6 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-9V3M7 16h10"/>',
  box: '<path d="m12 3 9 5v9l-9 5-9-5V8Zm-9 5 9 5 9-5M12 13v9M7 5l9 5"/>',
  link: '<path d="m10 13 4-4m-6 6-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  github:
    '<path d="M9 19c-5 1-5-2-7-2m14 4v-4a4 4 0 0 0-1-3c4 0 7-2 7-6a5 5 0 0 0-1-3 5 5 0 0 0 0-3s-2-1-5 2a15 15 0 0 0-8 0C5 1 3 2 3 2a5 5 0 0 0 0 3 5 5 0 0 0-1 3c0 4 3 6 7 6a4 4 0 0 0-1 3v4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3v1"/>',
  activity: '<path d="M2 12h5l3-9 4 18 3-9h5"/>',
  minus: '<path d="M5 12h14"/>',
  sidebar:
    '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M9 4v16"/>',
}
const icon = (name: string, h: H): Html =>
  h.span([
    h.Class('icon'),
    h.AriaHidden(true),
    h.InnerHTML(
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${paths[name] ?? paths.agent}</svg>`,
    ),
  ])
const button = (
  text: string,
  message: Message,
  style: string,
  h: H,
  symbol?: string,
): Html =>
  h.button(
    [h.Type('button'), h.Class(`button ${style}`), h.OnClick(message)],
    [...(symbol ? [icon(symbol, h)] : []), text],
  )
const iconButton = (
  name: string,
  label: string,
  message: Message,
  h: H,
): Html =>
  h.button(
    [
      h.Type('button'),
      h.Class('icon-button'),
      h.AriaLabel(label),
      h.OnClick(message),
    ],
    [icon(name, h)],
  )
const badge = (text: string, h: H): Html =>
  h.span(
    [
      h.Class(
        `badge ${['Verified', 'Completed', 'Approved', 'Enabled'].includes(text) ? 'positive' : ['Needs review', 'Pending', 'Paused'].includes(text) ? 'warning' : text === 'Running' ? 'running' : 'neutral'}`,
      ),
    ],
    [h.span([h.Class('status-dot')]), text],
  )
const ghostLayout = (layout: 'table' | 'graph' | 'run', h: H): Html =>
  h.div(
    [h.Class(`ghost-layout ghost-${layout}`), h.AriaHidden(true)],
    Array.makeBy(layout === 'table' ? 5 : layout === 'graph' ? 6 : 3, index =>
      h.span([h.Class(`ghost-block ghost-block-${index}`)]),
    ),
  )
const empty = (
  title: string,
  detail: string,
  h: H,
  layout?: 'table' | 'graph' | 'run',
  action?: Html,
): Html =>
  h.div(
    [h.Class(`empty-state ${layout ? 'with-ghost' : ''}`)],
    [
      layout ? ghostLayout(layout, h) : icon('layers', h),
      h.h3([], [title]),
      h.p([], [detail]),
      action ?? h.empty,
    ],
  )
const chip = (label: string, value: string, h: H): Html =>
  h.span(
    [h.Class('chip')],
    [h.span([h.Class('chip-label mono')], [label]), value],
  )
const pages: ReadonlyArray<{ page: Page; icon: string }> = [
  { page: 'Overview', icon: 'grid' },
  { page: 'Digital twin', icon: 'box' },
  { page: 'Systems graph', icon: 'graph' },
  { page: 'Requirements', icon: 'file' },
  { page: 'Branches', icon: 'layers' },
  { page: 'Agent fleet', icon: 'agent' },
  { page: 'Runs', icon: 'play' },
  { page: 'Integrations', icon: 'plug' },
]
const sidebarInbox = (model: Model, h: H): Html => {
  const pending = model.workspace.approvals.filter(
    item => item.status === 'Pending',
  ).length
  return h.button(
    [
      h.Type('button'),
      h.Class('nav-item inbox-item'),
      h.Title('Inbox'),
      h.OnClick(Message.SelectedInbox()),
    ],
    [
      icon('check', h),
      'Inbox',
      pending > 0
        ? h.span(
            [h.Class('nav-count'), h.AriaLabel(`${pending} pending approvals`)],
            [String(pending)],
          )
        : h.empty,
    ],
  )
}
const sidebarViews = (model: Model, h: H): Html =>
  h.div(
    [h.Class('sidebar-views')],
    [
      h.button(
        [
          h.Type('button'),
          h.Class('nav-label nav-toggle'),
          h.AriaExpanded(!model.isViewsCollapsed),
          h.OnClick(Message.ToggledViewsSection()),
        ],
        [
          icon('chevron', h),
          'VIEWS',
          h.span(
            [h.Class('tiny-label')],
            [String(model.workspace.views.length)],
          ),
        ],
      ),
      model.isViewsCollapsed
        ? h.empty
        : h.ul(
            [h.Class('view-list')],
            [
              ...model.workspace.views.map(view =>
                h.keyed('li')(
                  view.id,
                  [h.Class('view-row')],
                  [
                    h.button(
                      [
                        h.Type('button'),
                        h.Class(
                          `view-link ${model.page === 'Requirements' && matchesSavedView(model, view) ? 'active' : ''}`,
                        ),
                        h.OnClick(Message.SelectedSavedView({ id: view.id })),
                      ],
                      [h.span([h.Class('view-dot')]), view.name],
                    ),
                    h.button(
                      [
                        h.Type('button'),
                        h.Class('view-delete'),
                        h.AriaLabel(`Delete view ${view.name}`),
                        h.OnClick(Message.ClickedDeleteView({ id: view.id })),
                      ],
                      ['×'],
                    ),
                  ],
                ),
              ),
              h.keyed('li')(
                'save-view',
                [],
                [
                  h.button(
                    [
                      h.Type('button'),
                      h.Class('view-link add'),
                      h.OnClick(Message.ClickedSaveView()),
                    ],
                    [icon('plus', h), 'Save current view'],
                  ),
                ],
              ),
            ],
          ),
    ],
  )
export const setupSteps = (
  model: Model,
): ReadonlyArray<
  Readonly<{ label: string; done: boolean; message: Message }>
> => [
  {
    label: 'Import requirements',
    done: model.workspace.requirements.length > 0,
    message: Message.ClickedImport(),
  },
  {
    label: 'Enable agents',
    done: model.workspace.agents.some(agent => agent.enabled),
    message: Message.SelectedPage({ page: 'Agent fleet' }),
  },
  {
    label: 'Launch first run',
    done: model.workspace.runs.length > 0,
    message: Message.ClickedLaunch(),
  },
  {
    label: 'Review a finding',
    done: model.workspace.approvals.some(item => item.status !== 'Pending'),
    message: Message.SelectedPage({ page: 'Overview' }),
  },
  {
    label: 'Save a view',
    done: model.workspace.views.length > 0,
    message: Message.ClickedSaveView(),
  },
]
const setupChecklist = (model: Model, h: H): Html => {
  const steps = setupSteps(model)
  const done = steps.filter(step => step.done).length
  const percent = Math.round((done / steps.length) * 100)
  return percent === 100
    ? h.empty
    : h.div(
        [h.Class('setup-checklist'), h.AriaLabel('Setup checklist')],
        [
          h.div(
            [h.Class('setup-head')],
            [
              h.span([h.Class('nav-label')], ['SETUP']),
              h.span([h.Class('mono small-text')], [`${percent}%`]),
            ],
          ),
          h.div(
            [h.Class('setup-track')],
            [h.div([h.Style({ width: `${percent}%` })])],
          ),
          h.ul(
            [],
            steps.map(step =>
              h.keyed('li')(
                step.label,
                [],
                [
                  h.button(
                    [
                      h.Type('button'),
                      h.Class(`setup-step ${step.done ? 'done' : ''}`),
                      h.OnClick(step.message),
                    ],
                    [
                      h.span([h.Class('setup-box')], [step.done ? '✓' : '']),
                      step.label,
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      )
}
const sidebarResizer = (model: Model, h: H): Html =>
  model.isSidebarCollapsed
    ? h.empty
    : h.div([
        h.Class(`sidebar-resizer ${model.isResizingSidebar ? 'active' : ''}`),
        h.Role('separator'),
        h.AriaOrientation('vertical'),
        h.AriaLabel('Resize sidebar'),
        h.AriaValuemin(sidebarMinWidth),
        h.AriaValuemax(sidebarMaxWidth),
        h.AriaValuenow(model.sidebarWidth),
        h.Tabindex(0),
        h.Title('Drag to resize · double-click to reset'),
        h.OnPointerDown((_pointerType, mouseButton) =>
          mouseButton === 0
            ? Option.some(Message.PressedSidebarHandle())
            : Option.none(),
        ),
        h.OnDoubleClick(Message.ResetSidebarWidth()),
        h.OnKeyDown(key => Message.PressedSidebarHandleKey({ key })),
      ])
type OrgTenant = 'Gov' | 'Commercial'

const currentOrg: { readonly name: string; readonly tenant: OrgTenant } = {
  name: 'Moneywell',
  tenant: 'Gov',
}

const tenantBadge = (tenant: OrgTenant, h: H): Html =>
  h.span(
    [
      h.Class(`tenant-badge ${tenant === 'Gov' ? 'gov' : 'commercial'}`),
      h.Title(
        tenant === 'Gov'
          ? 'Government organization'
          : 'Commercial organization',
      ),
    ],
    [tenant === 'Gov' ? 'GOV' : 'COM'],
  )

const workspaceMenu = (model: Model, h: H): Html =>
  h.div(
    [h.Class('workspace-menu-root')],
    [
      h.button(
        [
          h.Type('button'),
          h.Class('workspace-switch'),
          h.AriaHasPopup('menu'),
          h.AriaExpanded(model.isWorkspaceMenuOpen),
          h.AriaLabel('Switch organization or program'),
          h.OnClick(Message.ToggledWorkspaceMenu()),
        ],
        [
          h.span([h.Class('workspace-avatar')], ['M']),
          h.div(
            [],
            [
              h.strong([], [currentOrg.name]),
              h.span([], ['Atlas launch program']),
            ],
          ),
          icon('down', h),
        ],
      ),
      model.isWorkspaceMenuOpen
        ? h.div(
            [h.Class('workspace-menu'), h.Role('menu')],
            [
              h.p([h.Class('nav-label')], ['Organization']),
              h.button(
                [
                  h.Type('button'),
                  h.Class('workspace-menu-item'),
                  h.Role('menuitemradio'),
                  h.AriaChecked(true),
                  h.OnClick(Message.ClosedWorkspaceMenu()),
                ],
                [
                  h.span([h.Class('workspace-avatar small')], ['M']),
                  h.strong(
                    [h.Class('org-name')],
                    [currentOrg.name, tenantBadge(currentOrg.tenant, h)],
                  ),
                  icon('check', h),
                ],
              ),
              h.p([h.Class('nav-label')], ['Programs']),
              h.button(
                [
                  h.Type('button'),
                  h.Class('workspace-menu-item'),
                  h.Role('menuitemradio'),
                  h.AriaChecked(true),
                  h.OnClick(Message.ClosedWorkspaceMenu()),
                ],
                [
                  h.span([h.Class('program-dot')]),
                  h.div(
                    [],
                    [
                      h.strong([], ['Atlas launch program']),
                      h.span([], ['Sample engineering program']),
                    ],
                  ),
                  icon('check', h),
                ],
              ),
            ],
          )
        : h.empty,
    ],
  )

const sidebar = (model: Model, h: H): Html =>
  h.aside(
    [h.Class('sidebar')],
    [
      h.div(
        [h.Class('sidebar-top')],
        [
          h.div(
            [h.Class('brand')],
            [
              h.span([h.Class('brand-mark')], [icon('layers', h)]),
              'stream',
              h.span([h.Class('beta')], ['GOV']),
            ],
          ),
          workspaceMenu(model, h),
        ],
      ),
      h.div(
        [h.Class('sidebar-scroll')],
        [
          h.nav(
            [h.AriaLabel('Workspace navigation')],
            pages.map(item =>
              h.keyed('button')(
                item.page,
                [
                  h.Type('button'),
                  h.Class(
                    `nav-item ${model.page === item.page ? 'active' : ''}`,
                  ),
                  h.OnClick(Message.SelectedPage({ page: item.page })),
                  h.Title(item.page),
                  h.AriaCurrent(model.page === item.page ? 'page' : 'false'),
                ],
                [
                  icon(item.icon, h),
                  item.page,
                  item.page === 'Runs' &&
                  model.workspace.runs.some(run => run.status === 'Running')
                    ? h.span(
                        [h.Class('nav-count')],
                        [
                          String(
                            model.workspace.runs.filter(
                              run => run.status === 'Running',
                            ).length,
                          ),
                        ],
                      )
                    : h.empty,
                ],
              ),
            ),
          ),
          sidebarInbox(model, h),
          sidebarViews(model, h),
          setupChecklist(model, h),
        ],
      ),
      h.div(
        [h.Class('sidebar-bottom')],
        [
          model.page === 'Requirements' || model.page === 'Systems graph'
            ? h.div(
                [h.Class('sidebar-projects')],
                [
                  model.page === 'Requirements' ||
                  model.page === 'Systems graph'
                    ? h.select(
                        [
                          h.AriaLabel('Discipline view'),
                          h.Class('discipline-selector'),
                          h.Value(
                            Requirement.fields.kind.literals.some(
                              kind => kind === model.filter,
                            )
                              ? model.filter
                              : 'All artifacts',
                          ),
                          h.OnChange(value =>
                            Message.SelectedDisciplineView({ value }),
                          ),
                        ],
                        [
                          h.option(
                            [h.Value('All artifacts')],
                            ['All artifacts'],
                          ),
                          ...Requirement.fields.kind.literals.map(kind =>
                            h.keyed('option')(
                              kind,
                              [h.Value(kind)],
                              [
                                kind === 'System'
                                  ? 'Systems'
                                  : kind === 'Requirement'
                                    ? 'Requirements'
                                    : kind === 'Function'
                                      ? 'Functions'
                                      : kind === 'Interface'
                                        ? 'Interfaces'
                                        : kind === 'Test'
                                          ? 'Tests'
                                          : kind === 'Design'
                                            ? 'Design Capability'
                                            : 'Safety & Risks',
                              ],
                            ),
                          ),
                        ],
                      )
                    : h.empty,
                  model.page === 'Requirements' ||
                  model.page === 'Systems graph'
                    ? artifactTreeView(model, model.workspace.requirements, h)
                    : h.empty,
                ],
              )
            : h.empty,
          h.div(
            [h.Class('profile')],
            [
              h.span([h.Class('avatar dark')], ['BJ']),
              h.div(
                [],
                [
                  h.strong([], ['Ben Juntilla']),
                  h.span([], ['Workspace owner']),
                ],
              ),
              h.span([h.Class('profile-indicator')]),
            ],
          ),
        ],
      ),
      sidebarResizer(model, h),
    ],
  )

const topbar = (model: Model, h: H): Html =>
  h.header(
    [h.Class('topbar')],
    [
      h.div(
        [h.Class('breadcrumb')],
        [
          iconButton(
            'sidebar',
            model.isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar',
            Message.ToggledSidebar(),
            h,
          ),
          h.span([], ['Moneywell']),
          icon('chevron', h),
          h.strong([], ['Atlas launch program']),
          icon('chevron', h),
          h.span([], [model.page]),
        ],
      ),
      h.div(
        [h.Class('topbar-right')],
        [
          h.button(
            [
              h.Type('button'),
              h.Class('palette-trigger'),
              h.AriaLabel('Open command palette'),
              h.OnClick(Message.PressedCommandPalette()),
            ],
            [icon('search', h), 'Jump to…', h.kbd([], ['⌘K'])],
          ),
          h.label(
            [h.Class('branch-field')],
            [
              h.span([h.Class('branch-field-label')], ['Branch:']),
              h.select(
                [
                  h.Class('branch-select'),
                  h.AriaLabel('Active branch'),
                  h.Value(Option.getOrElse(model.maybeActiveBranch, () => '')),
                  h.OnChange(id => Message.SelectedBranch({ id })),
                ],
                [
                  h.option([h.Value('')], ['Base']),
                  ...model.workspace.branches
                    .filter(branch => branch.status === 'Draft')
                    .map(branch =>
                      h.keyed('option')(
                        branch.id,
                        [h.Value(branch.id)],
                        [branch.title],
                      ),
                    ),
                ],
              ),
            ],
          ),
          h.span(
            [
              h.Class(
                `save-status ${model.storage === 'Unavailable' ? 'storage-error' : ''}`,
              ),
              h.Title(
                model.storage === 'Unavailable'
                  ? 'Not saved'
                  : model.storage === 'Loading'
                    ? 'Loading workspace'
                    : 'Saved locally',
              ),
            ],
            [
              icon(model.storage === 'Unavailable' ? 'alert' : 'check', h),
              model.storage === 'Loading'
                ? 'Loading workspace'
                : model.storage === 'Unavailable'
                  ? 'Not saved'
                  : 'Saved locally',
            ],
          ),
          h.span([h.Class('vertical-divider')]),
          h.span(
            [h.Class('avatar-stack')],
            [
              h.span([h.Class('avatar')], ['SC']),
              h.span([h.Class('avatar lavender')], ['AR']),
              h.span([h.Class('avatar dark')], ['BJ']),
            ],
          ),
        ],
      ),
    ],
  )

const graphPositions = (
  items: ReadonlyArray<Requirement>,
  compact: boolean,
): ReadonlyArray<{ item: Requirement; x: number; y: number }> => {
  const roots = items.filter(
    item => !items.some(parent => parent.links.includes(item.id)),
  )
  const depth = (id: string, visited: ReadonlyArray<string>): number => {
    if (visited.includes(id)) {
      return 0
    }
    const parents = items.filter(item => item.links.includes(id))
    return Array.isArrayEmpty(parents)
      ? 0
      : Math.min(
          compact ? 2 : 3,
          Math.max(
            ...parents.map(parent => depth(parent.id, visited.concat(id))),
          ) + 1,
        )
  }
  const columns = items.map(item => ({
    item,
    column: roots.some(root => root.id === item.id) ? 0 : depth(item.id, []),
  }))
  const lastColumn = Math.max(0, ...columns.map(entry => entry.column))
  const placed = Array.range(0, lastColumn).reduce<
    ReadonlyArray<{ item: Requirement; column: number; row: number }>
  >((done, column) => {
    const weight = (item: Requirement): number => {
      const parents = done.filter(parent => parent.item.links.includes(item.id))
      return Array.isArrayEmpty(parents)
        ? Number.MAX_SAFE_INTEGER
        : parents.reduce((sum, parent) => sum + parent.row, 0) / parents.length
    }
    const entries = columns.filter(entry => entry.column === column)
    const ordered =
      column === 0
        ? entries
        : Array.sortWith(entries, entry => weight(entry.item), Order.Number)
    return done.concat(
      ordered.map((entry, row) => ({ item: entry.item, column, row })),
    )
  }, [])
  return placed.map(entry => ({
    item: entry.item,
    x: 28 + entry.column * 242,
    y: 36 + entry.row * 134,
  }))
}
const lineage = (
  items: ReadonlyArray<Requirement>,
  id: string,
  visited: ReadonlyArray<string>,
): ReadonlyArray<string> =>
  items.flatMap(parent =>
    parent.links.includes(id) && !visited.includes(parent.id)
      ? [parent.id].concat(lineage(items, parent.id, visited.concat(parent.id)))
      : [],
  )
const graphHeight = (
  positions: ReadonlyArray<{ y: number }>,
  compact: boolean,
): number =>
  Math.max(compact ? 416 : 490, ...positions.map(position => position.y + 144))
const graph = (model: Model, compact: boolean, h: H): Html => {
  const positions = graphPositions(model.workspace.requirements, compact)
  const width = compact ? 744 : 966
  const height = graphHeight(positions, compact)
  const zoom = compact ? 1 : model.graphZoom
  const selected = Option.getOrElse(model.maybeSelectedNode, () => '')
  const related = selected
    ? downstream(model.workspace.requirements, selected).concat(
        lineage(model.workspace.requirements, selected, [selected]),
        selected,
      )
    : []
  const latest = model.workspace.runs[0]
  const runTint = (id: string): string =>
    !latest || !latest.requirements.some(item => item.id === id)
      ? ''
      : latest.tasks.some(task => task.status === 'Failed')
        ? 'run-failed'
        : `run-${latest.status.toLowerCase()}`
  const preview = (id: string): string =>
    summarizeFinding(
      latest?.tasks.find(task => task.output.includes(id))?.output ?? '',
    ).title
  const edges = positions.flatMap(source =>
    source.item.links.flatMap(id => {
      const target = positions.find(position => position.item.id === id)
      if (!target) {
        return []
      }
      const x1 = source.x + 192,
        y1 = source.y + 42,
        x2 = target.x,
        y2 = target.y + 42
      const state = !selected
        ? ''
        : related.includes(source.item.id) && related.includes(target.item.id)
          ? 'active'
          : 'muted'
      return [
        `<path class="${state}" d="M${x1} ${y1} C${x1 + 38} ${y1},${x2 - 38} ${y2},${x2} ${y2}" fill="none"/><circle class="${state}" cx="${x2}" cy="${y2}" r="3"/>`,
      ]
    }),
  )
  return h.div(
    [h.Class(`graph-scroll ${compact ? 'compact' : ''}`)],
    [
      h.div(
        [h.Class('graph-plane')],
        [
          h.div([
            h.Class('graph-backdrop'),
            h.AriaHidden(true),
            h.OnPointerDown(
              (_pointerType, mouseButton, _screenX, _screenY, _time, x, y) =>
                mouseButton === 0
                  ? Option.some(Message.PressedGraphCanvas({ x, y }))
                  : Option.none(),
            ),
            h.OnClick(Message.ClickedGraphBackdrop()),
          ]),
          h.div(
            [
              h.Class('graph-sizer'),
              h.Style({
                width: `${width * zoom}px`,
                height: `${height * zoom}px`,
              }),
            ],
            [
              h.div(
                [
                  h.Class('graph-canvas'),
                  h.Style({
                    width: `${width}px`,
                    height: `${height}px`,
                    transform: `scale(${zoom})`,
                  }),
                ],
                [
                  h.div([
                    h.Class('edge-layer'),
                    h.AriaHidden(true),
                    h.InnerHTML(
                      `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${edges.join('')}</svg>`,
                    ),
                  ]),
                  ...positions.map(({ item, x, y }) =>
                    h.keyed('button')(
                      item.id,
                      [
                        h.Type('button'),
                        h.Class(
                          `graph-node ${selected === item.id ? 'selected' : ''} ${related.includes(item.id) ? 'related' : ''} ${selected && !related.includes(item.id) ? 'dimmed' : ''} ${runTint(item.id)}`,
                        ),
                        h.Style({ left: `${x}px`, top: `${y}px` }),
                        h.OnClick(Message.SelectedNode({ id: item.id })),
                        h.Attribute('data-node-id', item.id),
                        h.AriaLabel(`Inspect ${item.title}`),
                      ],
                      [
                        h.div(
                          [h.Class('node-meta')],
                          [
                            h.span(
                              [h.Class(`node-icon ${item.kind.toLowerCase()}`)],
                              [
                                icon(
                                  item.kind === 'Test'
                                    ? 'test'
                                    : item.kind === 'Design'
                                      ? 'box'
                                      : item.kind === 'Interface'
                                        ? 'plug'
                                        : 'file',
                                  h,
                                ),
                              ],
                            ),
                            h.span([], [item.id]),
                            h.span([
                              h.Class(
                                `node-status ${item.status === 'Verified' ? '' : 'amber'}`,
                              ),
                            ]),
                          ],
                        ),
                        h.strong([], [item.title]),
                        h.span(
                          [h.Class('node-kind')],
                          [item.kind, h.span([], [`r${item.revision}`])],
                        ),
                        !compact && preview(item.id)
                          ? h.span(
                              [h.Class('node-preview mono')],
                              [preview(item.id)],
                            )
                          : h.empty,
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  )
}
const graphControls = (model: Model, h: H): Html =>
  h.div(
    [h.Class('graph-controls'), h.Role('group'), h.AriaLabel('Graph zoom')],
    [
      iconButton(
        'minus',
        'Zoom out',
        Message.ClickedGraphZoom({ direction: 'Out' }),
        h,
      ),
      h.button(
        [
          h.Type('button'),
          h.Class('zoom-level mono'),
          h.AriaLabel('Reset zoom'),
          h.OnClick(Message.ClickedGraphZoom({ direction: 'Reset' })),
        ],
        [`${Math.round(model.graphZoom * 100)}%`],
      ),
      iconButton(
        'plus',
        'Zoom in',
        Message.ClickedGraphZoom({ direction: 'In' }),
        h,
      ),
    ],
  )
const approvalDiff = (model: Model, approval: Approval, h: H): Html => {
  const snapshot = model.workspace.runs
    .find(run => run.id === approval.runId)
    ?.requirements.find(item => item.id === approval.targetId)
  const current = model.workspace.requirements.find(
    item => item.id === approval.targetId,
  )
  if (!current) {
    return h.empty
  }
  const rows: ReadonlyArray<{ label: string; before: string; after: string }> =
    [
      { label: 'Title', before: snapshot?.title ?? '—', after: current.title },
      {
        label: 'Status',
        before: snapshot?.status ?? '—',
        after: current.status,
      },
      { label: 'Owner', before: snapshot?.owner ?? '—', after: current.owner },
      {
        label: 'Revision',
        before: snapshot ? `r${snapshot.revision}` : '—',
        after: `r${current.revision}`,
      },
      {
        label: 'Links',
        before: snapshot?.links.join(', ') || '—',
        after: current.links.join(', ') || '—',
      },
    ]
  const changed = snapshot
    ? rows.filter(row => row.before !== row.after).length
    : 0
  return h.details(
    [h.Class('approval-diff')],
    [
      h.summary(
        [],
        [
          !snapshot
            ? 'Current artifact · no run snapshot recorded'
            : changed === 0
              ? 'Compare with run snapshot · unchanged'
              : `Compare with run snapshot · ${changed} changed`,
        ],
      ),
      h.table(
        [h.Class('diff-table')],
        [
          h.thead(
            [],
            [
              h.tr(
                [],
                [
                  h.th([], ['Field']),
                  h.th([], [`At ${approval.runId}`]),
                  h.th([], ['Now']),
                ],
              ),
            ],
          ),
          h.tbody(
            [],
            rows.map(row =>
              h.keyed('tr')(
                row.label,
                [
                  h.Class(
                    snapshot && row.before !== row.after ? 'changed' : '',
                  ),
                ],
                [
                  h.td([], [row.label]),
                  h.td([h.Class('mono')], [row.before]),
                  h.td([h.Class('mono')], [row.after]),
                ],
              ),
            ),
          ),
        ],
      ),
    ],
  )
}

const impactStrip = (model: Model, approval: Approval, h: H): Html => {
  const counts = impactCounts(model.workspace, approval)
  const cells: ReadonlyArray<readonly [string, string, boolean]> = [
    ['Added', counts.hasSnapshot ? String(counts.added) : '—', false],
    ['Changed', counts.hasSnapshot ? String(counts.changed) : '—', false],
    ['Removed', counts.hasSnapshot ? String(counts.removed) : '—', false],
    ['Downstream', String(counts.downstream), false],
    ['Tests affected', String(counts.tests), false],
    ['Broken links', String(counts.brokenLinks), counts.brokenLinks > 0],
  ]
  return h.dl(
    [h.Class('impact-strip'), h.AriaLabel(`Impact of ${approval.id}`)],
    cells.map(([label, value, isAlert]) =>
      h.keyed('div')(
        label,
        [h.Class(isAlert ? 'impact-cell alert' : 'impact-cell')],
        [h.dt([], [label]), h.dd([h.Class('mono')], [value])],
      ),
    ),
  )
}

const reviewBar = (
  model: Model,
  pending: ReadonlyArray<Approval>,
  h: H,
): Html => {
  const ids = pending.map(approval => approval.id)
  const viewed = ids.filter(id => model.viewedApprovalIds.includes(id)).length
  const staged = model.stagedDecisions.filter(item => ids.includes(item.id))
  const missingReason = staged.some(
    item => item.decision === 'Rejected' && !item.reason.trim(),
  )
  return h.div(
    [h.Class('review-bar'), h.AriaLive('polite')],
    [
      h.div(
        [h.Class('review-progress')],
        [
          h.strong([h.Class('mono')], [`${viewed}/${ids.length} reviewed`]),
          h.div(
            [h.Class('progress-track')],
            [
              h.div([
                h.Style({
                  width: `${ids.length ? (viewed / ids.length) * 100 : 0}%`,
                }),
              ]),
            ],
          ),
          h.span(
            [h.Class('muted small-text')],
            [
              `${staged.length} pending decision${staged.length === 1 ? '' : 's'}`,
            ],
          ),
        ],
      ),
      h.div(
        [h.Class('review-actions')],
        [
          Array.isArrayEmpty(staged)
            ? h.empty
            : button('Clear', Message.ClearedReview(), 'ghost small', h),
          h.button(
            [
              h.Type('button'),
              h.Class('button primary small'),
              h.Disabled(Array.isArrayEmpty(staged) || missingReason),
              h.OnClick(Message.SubmittedReview()),
            ],
            [icon('check', h), `Submit review (${staged.length})`],
          ),
          Array.isArrayEmpty(staged)
            ? h.span(
                [h.Class('muted small-text')],
                ['Approve or dismiss at least one finding to submit.'],
              )
            : h.empty,
        ],
      ),
    ],
  )
}

const approvals = (
  model: Model,
  items: ReadonlyArray<Approval>,
  h: H,
): Html => {
  const pending = items.filter(approval => approval.status === 'Pending')
  return h.div(
    [h.Class('approval-list')],
    Array.match(items, {
      onEmpty: () => [
        empty(
          'All caught up',
          'New agent findings will appear here for your review.',
          h,
        ),
      ],
      onNonEmpty: rows => [
        Array.isArrayEmpty(pending) ? h.empty : reviewBar(model, pending, h),
        ...rows.map(approval => {
          const maybeStaged = model.stagedDecisions.find(
            item => item.id === approval.id,
          )
          const isViewed = model.viewedApprovalIds.includes(approval.id)
          return h.keyed('article')(
            approval.id,
            [
              h.Attribute(
                'style',
                `--vt-name: approval-${approval.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
              ),
              h.Class(
                `approval-row${isViewed ? ' viewed' : ''}${maybeStaged ? ` staged-${maybeStaged.decision.toLowerCase()}` : ''}`,
              ),
            ],
            [
              h.span([h.Class('review-icon')], [icon('alert', h)]),
              h.div(
                [h.Class('approval-content')],
                [
                  h.h3([], [approval.title]),
                  isLongFinding(approval.detail)
                    ? findingPreview(
                        {
                          runId: approval.runId,
                          agentId: approval.agentId,
                          text: approval.detail,
                          status: undefined,
                          source: approval.title,
                          target: approval.targetId,
                        },
                        h,
                      )
                    : h.p([], [approval.detail]),
                  h.div(
                    [h.Class('row-meta')],
                    [
                      h.span([], [approval.targetId]),
                      h.span([], ['·']),
                      h.span(
                        [],
                        [
                          model.workspace.agents.find(
                            agent => agent.id === approval.agentId,
                          )?.name ?? 'Review coordinator',
                        ],
                      ),
                      h.span([], ['·']),
                      h.span([], [approval.runId]),
                    ],
                  ),
                  impactStrip(model, approval, h),
                  approvalDiff(model, approval, h),
                  maybeStaged?.decision === 'Rejected'
                    ? h.label(
                        [h.Class('form-field dismiss-reason')],
                        [
                          h.span([], ['Reason for dismissing (required)']),
                          h.input([
                            h.Value(maybeStaged.reason),
                            h.Required(true),
                            h.Placeholder('e.g. Already covered by TST-004'),
                            h.OnInput(value =>
                              Message.UpdatedDismissReason({
                                id: approval.id,
                                value,
                              }),
                            ),
                          ]),
                        ],
                      )
                    : h.empty,
                ],
              ),
              approval.status === 'Pending'
                ? h.div(
                    [h.Class('approval-actions')],
                    [
                      h.label(
                        [h.Class('viewed-toggle')],
                        [
                          h.input([
                            h.Type('checkbox'),
                            h.Checked(isViewed),
                            h.OnChange(() =>
                              Message.ToggledApprovalViewed({
                                id: approval.id,
                              }),
                            ),
                          ]),
                          'Viewed',
                        ],
                      ),
                      h.button(
                        [
                          h.Type('button'),
                          h.Class(
                            `button small ${maybeStaged?.decision === 'Rejected' ? 'danger' : 'ghost'}`,
                          ),
                          h.AriaPressed(
                            String(maybeStaged?.decision === 'Rejected'),
                          ),
                          h.OnClick(
                            Message.StagedApprovalDecision({
                              id: approval.id,
                              decision: 'Rejected',
                            }),
                          ),
                        ],
                        ['Dismiss'],
                      ),
                      h.button(
                        [
                          h.Type('button'),
                          h.Class(
                            `button small ${maybeStaged?.decision === 'Approved' ? 'primary' : 'outline'}`,
                          ),
                          h.AriaPressed(
                            String(maybeStaged?.decision === 'Approved'),
                          ),
                          h.OnClick(
                            Message.StagedApprovalDecision({
                              id: approval.id,
                              decision: 'Approved',
                            }),
                          ),
                        ],
                        [icon('check', h), 'Approve'],
                      ),
                    ],
                  )
                : badge(approval.status, h),
            ],
          )
        }),
      ],
    }),
  )
}

const overview = (model: Model, h: H): Html => {
  const active = model.workspace.agents.filter(agent => agent.enabled)
  const pending = model.workspace.approvals.filter(
    item => item.status === 'Pending',
  )
  const covered = model.workspace.requirements.filter(
    item =>
      item.kind === 'Requirement' &&
      downstream(model.workspace.requirements, item.id).some(id =>
        model.workspace.requirements.some(
          test => test.id === id && test.kind === 'Test',
        ),
      ),
  )
  const total = model.workspace.requirements.filter(
    item => item.kind === 'Requirement',
  ).length
  const stats = [
    {
      label: 'Connected artifacts',
      value: String(model.workspace.requirements.length).padStart(2, '0'),
      icon: 'graph',
      detail: `${model.workspace.requirements.reduce((count, item) => count + item.links.length, 0)} dependency links`,
      positive: true,
    },
    {
      label: 'Enabled agents',
      value: String(active.length).padStart(2, '0'),
      icon: 'agent',
      detail: 'Ready to work in parallel',
      positive: true,
    },
    {
      label: 'Requirements coverage',
      value: `${total ? Math.round((covered.length / total) * 100) : 0}%`,
      icon: 'shield',
      detail: `${covered.length} of ${total} linked to tests`,
      positive: true,
    },
    {
      label: 'Awaiting your review',
      value: String(pending.length).padStart(2, '0'),
      icon: 'clock',
      detail: 'Pending human decisions',
      positive: false,
    },
  ]
  return h.div(
    [],
    [
      pageHeading(
        'Overview',
        'Artifacts, agent coverage, and decisions waiting on the active branch.',
        button(
          'Run agent fleet',
          Message.ClickedLaunch(),
          'primary',
          h,
          'play',
        ),
        h,
      ),
      h.div(
        [h.Class('program-banner')],
        [
          h.div(
            [h.Class('program-banner-title')],
            [
              h.span([h.Class('program-symbol')], [icon('box', h)]),
              h.div(
                [],
                [
                  h.strong([], ['Atlas launch program']),
                  h.span([], ['Autonomous systems · Engineering validation']),
                ],
              ),
            ],
          ),
          h.div(
            [h.Class('program-banner-right')],
            [
              h.span([h.Class('sample-pill')], ['SAMPLE WORKSPACE']),
              h.span(
                [h.Class('banner-status')],
                [
                  h.span([h.Class(`live-dot ${bannerStatus(model).tone}`)]),
                  bannerStatus(model).label,
                ],
              ),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class('stats-grid')],
        stats.map(stat =>
          h.keyed('article')(
            stat.label,
            [h.Class('stat-card')],
            [
              h.div([h.Class('stat-label')], [stat.label]),
              h.div([h.Class('stat-value')], [stat.value]),
              h.p(
                [h.Class(`stat-detail ${stat.positive ? '' : 'amber-text'}`)],
                [icon(stat.positive ? 'check' : 'clock', h), stat.detail],
              ),
            ],
          ),
        ),
      ),
      h.div(
        [h.Class('overview-grid')],
        [
          h.section(
            [h.Class('panel graph-panel')],
            [
              h.div(
                [h.Class('panel-heading')],
                [
                  h.div(
                    [],
                    [
                      h.h2([], ['Systems graph']),
                      h.p([], ['Dependency order, left to right.']),
                    ],
                  ),
                  button(
                    'Explore graph',
                    Message.SelectedPage({ page: 'Systems graph' }),
                    'text-button',
                    h,
                    'arrow',
                  ),
                ],
              ),
              graph(model, true, h),
              h.div(
                [h.Class('graph-footer')],
                [
                  h.div(
                    [h.Class('legend')],
                    [
                      h.span(
                        [],
                        [h.span([h.Class('legend-dot mint')]), 'Requirements'],
                      ),
                      h.span(
                        [],
                        [h.span([h.Class('legend-dot blue')]), 'Design'],
                      ),
                      h.span(
                        [],
                        [
                          h.span([h.Class('legend-dot violet')]),
                          'Verification',
                        ],
                      ),
                    ],
                  ),
                  h.span([], ['Click any artifact to inspect']),
                ],
              ),
            ],
          ),
          h.section(
            [h.Class('panel fleet-panel')],
            [
              h.div(
                [h.Class('panel-heading')],
                [
                  h.div(
                    [],
                    [
                      h.h2([], ['Agent fleet']),
                      h.p(
                        [],
                        ['Enabled agents run in parallel within a stage.'],
                      ),
                    ],
                  ),
                  h.span([h.Class('fleet-number')], [String(active.length)]),
                ],
              ),
              h.div(
                [h.Class('fleet-list')],
                model.workspace.agents
                  .slice(0, 5)
                  .map(agent =>
                    h.keyed('button')(
                      agent.id,
                      [
                        h.Type('button'),
                        h.Class('fleet-row'),
                        h.OnClick(Message.ClickedEditAgent({ id: agent.id })),
                      ],
                      [
                        h.span(
                          [h.Class(`agent-icon ${agent.color}`)],
                          [
                            icon(
                              agent.id === 'safety'
                                ? 'shield'
                                : agent.id === 'coverage'
                                  ? 'test'
                                  : agent.id === 'budget'
                                    ? 'layers'
                                    : agent.id === 'docs'
                                      ? 'file'
                                      : 'agent',
                              h,
                            ),
                          ],
                        ),
                        h.div(
                          [],
                          [
                            h.strong([], [agent.name]),
                            h.span([], [agent.category]),
                          ],
                        ),
                        h.span([
                          h.Class(
                            `availability-dot ${agent.enabled ? '' : 'off'}`,
                          ),
                        ]),
                        icon('chevron', h),
                      ],
                    ),
                  ),
              ),
              h.div(
                [h.Class('fleet-note')],
                [
                  icon('shield', h),
                  h.p(
                    [],
                    [
                      'Findings are proposals.',
                      h.strong([], [' Merges need human review.']),
                    ],
                  ),
                ],
              ),
              button(
                'Manage fleet',
                Message.SelectedPage({ page: 'Agent fleet' }),
                'fleet-manage',
                h,
                'arrow',
              ),
            ],
          ),
        ],
      ),
      h.section(
        [h.Id('overview-inbox'), h.Class('panel attention-panel')],
        [
          h.div(
            [h.Class('panel-heading')],
            [
              h.div(
                [h.Class('inline-heading')],
                [
                  h.h2([], ['Needs your attention']),
                  h.span([h.Class('count-pill')], [String(pending.length)]),
                ],
              ),
              h.span(
                [h.Class('muted small-text')],
                ['Nothing merges without approval'],
              ),
            ],
          ),
          approvals(model, pending, h),
        ],
      ),
      h.div(
        [h.Class('bottom-caption')],
        [
          h.span(
            [],
            [h.span([h.Class('live-dot')]), 'Workspace saved in this browser'],
          ),
          h.span([], ['Foldkit']),
        ],
      ),
    ],
  )
}

const search = (model: Model, placeholder: string, h: H): Html =>
  h.div(
    [h.Class('search-input')],
    [
      icon('search', h),
      h.input([
        h.Type('search'),
        h.AriaLabel(placeholder),
        h.Placeholder(placeholder),
        h.Value(model.search),
        h.OnInput(value => Message.UpdatedSearch({ value })),
      ]),
    ],
  )
const artifactAgentPane = (model: Model, h: H): Html =>
  h.aside(
    [h.Class('artifact-agent-pane')],
    [
      h.div(
        [h.Class('artifact-agent-heading')],
        [
          h.strong([], ['Agents']),
          button('New run', Message.ClickedLaunch(), 'primary small', h),
        ],
      ),
      h.p(
        [h.Class('muted small-text')],
        [
          model.executionMode === 'Simulation'
            ? 'Staged local simulation · review outputs before merging'
            : 'Workers AI via AI Gateway · review findings before merging',
        ],
      ),
      ...model.workspace.agents.map(agent =>
        h.keyed('button')(
          agent.id,
          [
            h.Type('button'),
            h.Class('fleet-row'),
            h.OnClick(Message.ClickedEditAgent({ id: agent.id })),
          ],
          [
            h.span([h.Class(`agent-icon ${agent.color}`)], [icon('agent', h)]),
            h.div(
              [],
              [
                h.strong([], [agent.name]),
                h.span(
                  [],
                  [agent.enabled ? `Stage ${agent.wave + 1}` : 'Disabled'],
                ),
              ],
            ),
            icon('chevron', h),
          ],
        ),
      ),
      button(
        'Run history',
        Message.SelectedPage({ page: 'Runs' }),
        'fleet-manage',
        h,
        'arrow',
      ),
    ],
  )
const sortHeader = (model: Model, label: string, key: SortKey, h: H): Html => {
  const isActive = Option.exists(model.maybeSortKey, active => active === key)
  const isAscending = model.sortDirection === 'Ascending'
  return h.th(
    [
      h.AriaSort(
        isActive ? (isAscending ? 'ascending' : 'descending') : 'none',
      ),
    ],
    [
      h.button(
        [
          h.Type('button'),
          h.Class(`sort-button ${isActive ? 'active' : ''}`),
          h.OnClick(Message.ClickedSortColumn({ key })),
        ],
        [
          label,
          h.span(
            [h.Class('sort-indicator'), h.AriaHidden(true)],
            [isActive ? (isAscending ? '↑' : '↓') : '↕'],
          ),
        ],
      ),
    ],
  )
}
const groupedRows =
  (model: Model, items: ReadonlyArray<Requirement>, h: H) =>
  (row: (item: Requirement) => Html): Array<Html> =>
    model.groupBy === 'None'
      ? items.map(row)
      : groupArtifacts(items, model.groupBy).flatMap(group => {
          const isCollapsed = model.collapsedGroups.includes(group.key)
          return [
            h.keyed('tr')(
              `group-${group.key}`,
              [h.Class('group-row')],
              [
                h.td(
                  [h.Attribute('colspan', '9')],
                  [
                    h.button(
                      [
                        h.Type('button'),
                        h.Class('group-toggle'),
                        h.AriaExpanded(!isCollapsed),
                        h.OnClick(Message.ToggledGroup({ key: group.key })),
                      ],
                      [
                        icon('chevron', h),
                        h.strong([], [group.label]),
                        h.span(
                          [h.Class('count-pill')],
                          [String(group.items.length)],
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ].concat(isCollapsed ? [] : group.items.map(row))
        })
const requirementsPage = (model: Model, h: H): Html => {
  const items = visibleArtifacts(model, model.workspace.requirements)
  const selectedIds = model.selectedArtifactIds.filter(id =>
    model.workspace.requirements.some(item => item.id === id),
  )
  const current = Option.getOrElse(model.maybeSelectedNode, () => '')
  const isAllSelected =
    items.length > 0 && items.every(item => selectedIds.includes(item.id))
  return h.div(
    [],
    [
      pageHeading(
        'Requirements',
        'Intent linked to design, verification, and the people responsible.',
        button(
          'New artifact',
          Message.ClickedNewRequirement(),
          'primary',
          h,
          'plus',
        ),
        h,
      ),
      h.section(
        [h.Class('panel')],
        [
          h.div(
            [h.Class('table-toolbar')],
            [
              search(model, 'Search artifacts…', h),
              h.select(
                [
                  h.AriaLabel('Filter artifacts'),
                  h.Value(model.filter),
                  h.OnChange(value => Message.SelectedFilter({ value })),
                ],
                [
                  'All artifacts',
                  ...Requirement.fields.kind.literals,
                  'Needs review',
                  'Verified',
                  'Draft',
                ].map(value => h.option([h.Value(value)], [value])),
              ),
              h.span(
                [h.Class('muted small-text nowrap')],
                [`${items.length} artifacts`],
              ),
              h.label(
                [h.Class('toolbar-select')],
                [
                  h.span([h.Class('mono muted')], ['GROUP']),
                  h.select(
                    [
                      h.AriaLabel('Group artifacts'),
                      h.Value(model.groupBy),
                      h.OnChange(value =>
                        Message.SelectedGroupBy({
                          groupBy:
                            GroupBy.literals.find(item => item === value) ??
                            'None',
                        }),
                      ),
                    ],
                    GroupBy.literals.map(value =>
                      h.option(
                        [h.Value(value)],
                        [value === 'None' ? 'No grouping' : value],
                      ),
                    ),
                  ),
                ],
              ),
              h.div(
                [h.Class('toolbar-end')],
                [
                  button(
                    'Save view',
                    Message.ClickedSaveView(),
                    'ghost small',
                    h,
                  ),
                  artifactViewSwitcher(model, h),
                  button(
                    'Fields',
                    Message.ClickedArtifactFields(),
                    'ghost small',
                    h,
                  ),
                  button('Import', Message.ClickedImport(), 'ghost small', h),
                  button('Export', Message.ClickedExport(), 'ghost small', h),
                ],
              ),
            ],
          ),
          Array.isArrayEmpty(selectedIds)
            ? h.empty
            : h.div(
                [
                  h.Class('bulk-bar floating'),
                  h.Role('region'),
                  h.AriaLabel('Bulk actions'),
                ],
                [
                  h.strong(
                    [h.Class('mono')],
                    [`${selectedIds.length} selected`],
                  ),
                  button(
                    'Mark needs review',
                    Message.SelectedBulkStatus({ status: 'Needs review' }),
                    'outline small',
                    h,
                  ),
                  button(
                    'Mark verified',
                    Message.SelectedBulkStatus({ status: 'Verified' }),
                    'outline small',
                    h,
                    'check',
                  ),
                  h.select(
                    [
                      h.AriaLabel('Assign owner'),
                      h.Class('bulk-owner'),
                      h.Value(''),
                      h.OnChange(owner => Message.SelectedBulkOwner({ owner })),
                    ],
                    [
                      h.option([h.Value('')], ['Assign owner…']),
                      ...Array.dedupe(
                        model.workspace.requirements.map(item => item.owner),
                      ).map(owner => h.option([h.Value(owner)], [owner])),
                    ],
                  ),
                  button(
                    'Clear selection',
                    Message.ClickedClearSelection(),
                    'ghost small',
                    h,
                  ),
                ],
              ),
          model.artifactView === 'Tree'
            ? h.div(
                [h.Class('artifact-tree-graph artifact-workspace')],
                [
                  graph(
                    modifyFields(model, {
                      workspace: workspace =>
                        modifyFields(workspace, {
                          requirements: () =>
                            artifactTree(model.workspace.requirements)
                              .filter(
                                row =>
                                  items.some(item => item.id === row.item.id) &&
                                  (model.search.length > 0 ||
                                    !row.ancestors.some(id =>
                                      model.collapsedArtifactIds.includes(id),
                                    )),
                              )
                              .map(row => row.item),
                        }),
                    }),
                    false,
                    h,
                  ),
                  artifactAgentPane(model, h),
                ],
              )
            : model.artifactView === 'Reader'
              ? artifactReaderView(items, h)
              : h.div(
                  [h.Class('table-scroll')],
                  [
                    h.table(
                      [
                        h.Class(
                          ArtifactField.literals
                            .filter(
                              field =>
                                !model.visibleArtifactFields.includes(field),
                            )
                            .map(field => `hide-${field.toLowerCase()}`)
                            .join(' '),
                        ),
                      ],
                      [
                        h.thead(
                          [],
                          [
                            h.tr(
                              [],
                              [
                                h.th(
                                  [h.Class('select-cell')],
                                  [
                                    h.input([
                                      h.Type('checkbox'),
                                      h.AriaLabel(
                                        'Select all visible artifacts',
                                      ),
                                      h.Checked(isAllSelected),
                                      h.OnChange(() =>
                                        Message.ToggledAllArtifacts(),
                                      ),
                                    ]),
                                  ],
                                ),
                                sortHeader(model, 'Artifact', 'Artifact', h),
                                sortHeader(model, 'Type', 'Type', h),
                                sortHeader(model, 'Status', 'Status', h),
                                sortHeader(model, 'Owner', 'Owner', h),
                                sortHeader(model, 'Links', 'Links', h),
                                sortHeader(model, 'Revision', 'Revision', h),
                                h.th(
                                  [],
                                  [
                                    h.span(
                                      [h.Class('visually-hidden')],
                                      ['Actions'],
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ],
                        ),
                        h.tbody(
                          [],
                          groupedRows(
                            model,
                            items,
                            h,
                          )(item =>
                            h.keyed('tr')(
                              item.id,
                              [
                                h.Class(
                                  `${current === item.id ? 'is-current' : ''} ${selectedIds.includes(item.id) ? 'is-checked' : ''}`,
                                ),
                              ],
                              [
                                h.td(
                                  [h.Class('select-cell')],
                                  [
                                    h.input([
                                      h.Type('checkbox'),
                                      h.AriaLabel(`Select ${item.id}`),
                                      h.Checked(selectedIds.includes(item.id)),
                                      h.OnChange(() =>
                                        Message.ToggledArtifactSelection({
                                          id: item.id,
                                        }),
                                      ),
                                    ]),
                                  ],
                                ),
                                h.td(
                                  [],
                                  [
                                    h.button(
                                      [
                                        h.Class('artifact-button'),
                                        h.OnClick(
                                          Message.SelectedNode({ id: item.id }),
                                        ),
                                      ],
                                      [
                                        h.span(
                                          [h.Class('mono muted')],
                                          [item.id],
                                        ),
                                        h.strong([], [item.title]),
                                      ],
                                    ),
                                  ],
                                ),
                                h.td(
                                  [],
                                  [
                                    h.span(
                                      [h.Class('type-label')],
                                      [
                                        icon(
                                          item.kind === 'Test'
                                            ? 'test'
                                            : item.kind === 'Design'
                                              ? 'box'
                                              : 'file',
                                          h,
                                        ),
                                        item.kind,
                                      ],
                                    ),
                                  ],
                                ),
                                h.td([], [badge(item.status, h)]),
                                h.td(
                                  [],
                                  [
                                    h.div(
                                      [h.Class('owner-cell')],
                                      [
                                        h.span(
                                          [h.Class('avatar tiny')],
                                          [
                                            item.owner
                                              .split(' ')
                                              .map(part => part[0])
                                              .join('')
                                              .slice(0, 2),
                                          ],
                                        ),
                                        item.owner,
                                      ],
                                    ),
                                  ],
                                ),
                                h.td(
                                  [],
                                  [
                                    h.span(
                                      [h.Class('link-count')],
                                      [
                                        icon('link', h),
                                        String(item.links.length),
                                      ],
                                    ),
                                  ],
                                ),
                                h.td([h.Class('mono')], [`r${item.revision}`]),
                                h.td(
                                  [],
                                  [
                                    button(
                                      'Edit',
                                      Message.ClickedEditRequirement({
                                        id: item.id,
                                      }),
                                      'ghost small',
                                      h,
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
          Array.isReadonlyArrayEmpty(items)
            ? Array.isReadonlyArrayEmpty(model.workspace.requirements)
              ? empty(
                  'No artifacts yet',
                  'Import requirements or create a new artifact.',
                  h,
                  'table',
                  button(
                    'Import requirements',
                    Message.ClickedImport(),
                    'primary',
                    h,
                    'download',
                  ),
                )
              : empty(
                  'No matching artifacts',
                  model.search
                    ? `Nothing matches “${model.search}” in ${model.filter}.`
                    : `Nothing matches ${model.filter}.`,
                  h,
                  undefined,
                  button(
                    'Clear search',
                    Message.UpdatedSearch({ value: '' }),
                    'outline',
                    h,
                  ),
                )
            : h.p(
                [h.Class('table-footer mono')],
                [
                  `${items.length} of ${model.workspace.requirements.length} rows · ${model.groupBy === 'None' ? 'ungrouped' : `grouped by ${model.groupBy.toLowerCase()}`}${selectedIds.length > 0 ? ` · ${selectedIds.length} selected` : ''}`,
                ],
              ),
          model.artifactView === 'Table'
            ? h.p(
                [h.Class('shortcut-hint')],
                [
                  h.kbd([], ['J']),
                  h.kbd([], ['K']),
                  ' move',
                  h.kbd([], ['X']),
                  ' select',
                  h.kbd([], ['E']),
                  ' edit',
                  h.kbd([], ['⌘K']),
                  ' commands',
                ],
              )
            : h.empty,
        ],
      ),
    ],
  )
}

const graphLegend = (h: H): Html =>
  h.div(
    [h.Class('graph-legend'), h.AriaLabel('Graph legend')],
    [
      ['legend-edge', 'Trace link'],
      ['legend-edge active', 'Selected path'],
      ['node-status', 'Verified'],
      ['node-status amber', 'Draft / review'],
      ['legend-swatch run-completed', 'Last run · done'],
      ['legend-swatch run-running', 'Running / paused'],
      ['legend-swatch run-failed', 'Failed agent'],
    ].map(([kind, label]) =>
      h.span(
        [h.Class('legend-item')],
        [h.span([h.Class(kind ?? '')]), label ?? ''],
      ),
    ),
  )
const graphPreview = (model: Model, h: H): Html => {
  const id = Option.getOrElse(model.maybeSelectedNode, () => '')
  const item = model.workspace.requirements.find(entry => entry.id === id)
  if (!item) {
    return h.empty
  }
  const latest = model.workspace.runs.find(run =>
    run.requirements.some(entry => entry.id === id),
  )
  const outputs = latest
    ? latest.tasks.filter(
        task =>
          task.output && (task.output.includes(id) || latest.targetId === id),
      )
    : []
  const inputs = model.workspace.requirements.filter(entry =>
    entry.links.includes(id),
  )
  const tab = model.graphPreviewTab
  return h.aside(
    [h.Class('graph-preview'), h.AriaLabel(`Preview ${id}`)],
    [
      h.div(
        [h.Class('graph-preview-head')],
        [h.span([h.Class('mono muted')], [id]), h.strong([], [item.title])],
      ),
      h.div(
        [h.Class('segmented run-view-toggle preview-tabs'), h.Role('tablist')],
        GraphPreviewTab.literals.map(option =>
          h.keyed('button')(
            option,
            [
              h.Type('button'),
              h.Role('tab'),
              h.AriaSelected(tab === option),
              h.Class(tab === option ? 'active' : ''),
              h.OnClick(Message.SelectedGraphPreviewTab({ tab: option })),
            ],
            [option],
          ),
        ),
      ),
      tab === 'Inputs'
        ? Array.isReadonlyArrayEmpty(inputs)
          ? h.p([h.Class('muted small-text')], ['No upstream artifacts.'])
          : h.ul(
              [h.Class('preview-list')],
              inputs.map(entry =>
                h.keyed('li')(
                  entry.id,
                  [],
                  [
                    h.button(
                      [
                        h.Type('button'),
                        h.Class('text-button'),
                        h.OnClick(Message.SelectedNode({ id: entry.id })),
                      ],
                      [h.span([h.Class('mono')], [entry.id]), ' ', entry.title],
                    ),
                  ],
                ),
              ),
            )
        : tab === 'Output'
          ? latest && !Array.isReadonlyArrayEmpty(outputs)
            ? h.ul(
                [h.Class('preview-list')],
                outputs.map(task =>
                  h.keyed('li')(
                    task.agentId,
                    [h.Class(task.status === 'Failed' ? 'is-failed' : '')],
                    [
                      h.span(
                        [h.Class('mono muted small-text')],
                        [
                          `${latest.agents.find(agent => agent.id === task.agentId)?.name ?? task.agentId} · ${task.status}`,
                        ],
                      ),
                      h.p(
                        [h.Class('small-text')],
                        [summarizeFinding(task.output, task.status).title],
                      ),
                    ],
                  ),
                ),
              )
            : h.p(
                [h.Class('muted small-text')],
                [
                  'No agent output for this artifact yet. Launch a run to analyze it.',
                ],
              )
          : h.dl(
              [h.Class('agent-detail-meta')],
              [
                h.dt([], ['Kind']),
                h.dd([], [item.kind]),
                h.dt([], ['Status']),
                h.dd([], [item.status]),
                h.dt([], ['Owner']),
                h.dd([], [item.owner]),
                h.dt([], ['Revision']),
                h.dd([h.Class('mono')], [`r${item.revision}`]),
                h.dt([], ['Latest run']),
                h.dd(
                  [h.Class('mono')],
                  [latest ? `${latest.id} · ${latest.status}` : '—'],
                ),
              ],
            ),
    ],
  )
}
const pausePoints = (model: Model, h: H): Html =>
  h.div(
    [h.Class('pause-points'), h.Role('group'), h.AriaLabel('Pause points')],
    [
      h.span([h.Class('mono muted small-text')], ['PAUSE AFTER']),
      ...stageNames
        .slice(0, -1)
        .map((name, wave) =>
          h.keyed('button')(
            name,
            [
              h.Type('button'),
              h.Class(
                `pause-point ${model.pauseAfter.includes(wave) ? 'active' : ''}`,
              ),
              h.AriaPressed(model.pauseAfter.includes(wave) ? 'true' : 'false'),
              h.OnClick(Message.ToggledPauseAfter({ wave })),
            ],
            [h.span([h.Class('breakpoint-dot')]), `0${wave + 1} ${name}`],
          ),
        ),
      h.span(
        [h.Class('muted small-text')],
        [
          model.executionMode === 'Simulation'
            ? 'Applies to new simulation runs.'
            : 'Simulation only. Live runs use Hold next stage.',
        ],
      ),
    ],
  )
const runHistory = (model: Model, h: H): Html =>
  h.div(
    [h.Class('run-history'), h.AriaLabel('Run history')],
    [
      h.span([h.Class('mono muted small-text')], ['RUNS']),
      ...model.workspace.runs
        .slice(0, 8)
        .map(run =>
          h.keyed('button')(
            run.id,
            [
              h.Type('button'),
              h.Class(
                `run-chip ${run.status.toLowerCase()} ${run.tasks.some(task => task.status === 'Failed') ? 'has-failed' : ''}`,
              ),
              h.Title(`${run.id} · ${run.title} · ${run.status}`),
              h.OnClick(Message.SelectedRun({ id: run.id })),
            ],
            [h.span([h.Class('status-dot')]), run.id],
          ),
        ),
      Array.isReadonlyArrayEmpty(model.workspace.runs)
        ? h.span([h.Class('muted small-text')], ['No runs yet'])
        : h.empty,
    ],
  )
const shortcutRows: ReadonlyArray<readonly [ReadonlyArray<string>, string]> = [
  [['⌘', 'K'], 'Open command palette'],
  [['?'], 'Show keyboard shortcuts'],
  [['['], 'Collapse or expand sidebar'],
  [['G', 'O'], 'Go to Overview'],
  [['G', 'S'], 'Go to Systems graph'],
  [['G', 'R'], 'Go to Requirements'],
  [['G', 'B'], 'Go to Branches'],
  [['G', 'A'], 'Go to Agent fleet'],
  [['G', 'N'], 'Go to Runs'],
  [['G', 'I'], 'Go to Integrations'],
  [['J', 'K'], 'Move between artifact rows'],
  [['X'], 'Select the current row'],
  [['E'], 'Edit the current row'],
  [['J', 'K'], 'Step between findings in the finding panel'],
  [['Esc'], 'Close dialog or finding panel'],
]
const graphPage = (model: Model, h: H): Html =>
  h.div(
    [h.Class('graph-page')],
    [
      pageHeading(
        'Systems graph',
        'Select an artifact to trace downstream impact and inspect its dependencies.',
        button(
          'New artifact',
          Message.ClickedNewRequirement(),
          'primary',
          h,
          'plus',
        ),
        h,
      ),
      h.section(
        [h.Class('panel full-graph-panel')],
        [
          h.div(
            [h.Class('panel-heading')],
            [
              h.div(
                [h.Class('inline-heading')],
                [
                  h.h2([], ['Atlas systems graph']),
                  h.span(
                    [h.Class('count-pill')],
                    [`${model.workspace.requirements.length} artifacts`],
                  ),
                ],
              ),
              button(
                'Analyze impact',
                Message.ClickedLaunch(),
                'outline small',
                h,
                'agent',
              ),
            ],
          ),
          h.div(
            [h.Class('graph-stage')],
            [
              Array.isReadonlyArrayEmpty(model.workspace.requirements)
                ? empty(
                    'No artifacts to graph',
                    'Import requirements or create an artifact to draw the systems graph.',
                    h,
                    'graph',
                    button(
                      'Import requirements',
                      Message.ClickedImport(),
                      'primary',
                      h,
                      'download',
                    ),
                  )
                : graph(model, false, h),
              h.div([h.Class('graph-overlay')], [graphControls(model, h)]),
              graphLegend(h),
              graphPreview(model, h),
            ],
          ),
          h.div(
            [h.Class('graph-footer')],
            [
              runHistory(model, h),
              pausePoints(model, h),
              button(
                'Clear selection',
                Message.ClosedInspector(),
                'ghost small',
                h,
              ),
            ],
          ),
        ],
      ),
    ],
  )

const agentToggle = (agent: Agent, h: H): Html =>
  h.button(
    [
      h.Type('button'),
      h.Class(`toggle ${agent.enabled ? 'on' : ''}`),
      h.Role('switch'),
      h.AriaChecked(agent.enabled),
      h.AriaLabel(`Enable ${agent.name}`),
      h.OnClick(Message.ToggledAgent({ id: agent.id })),
    ],
    [h.span([])],
  )
const stageLabel = (agent: Agent): string =>
  `0${agent.wave + 1} · ${stageNames[agent.wave] ?? 'Stage'}`
const agentDetail = (agent: Agent, h: H): Html =>
  h.aside(
    [h.Class('panel agent-detail'), h.AriaLabel(`${agent.name} details`)],
    [
      h.div(
        [h.Class('agent-detail-head')],
        [
          h.p([h.Class('eyebrow')], [agent.category]),
          h.h2([], [agent.name]),
          h.p([h.Class('muted')], [agent.description]),
        ],
      ),
      h.dl(
        [h.Class('agent-detail-meta')],
        [
          h.dt([], ['Stage']),
          h.dd([h.Class('mono')], [stageLabel(agent)]),
          h.dt([], ['Status']),
          h.dd([], [agent.enabled ? 'Enabled' : 'Disabled']),
          h.dt([], ['Concurrency']),
          h.dd([], ['Parallel with agents in the same stage']),
        ],
      ),
      h.h3([], ['Instructions']),
      h.p([h.Class('agent-instructions')], [agent.instructions]),
      h.div(
        [h.Class('agent-detail-actions')],
        [
          button(
            'Configure',
            Message.ClickedEditAgent({ id: agent.id }),
            'outline small',
            h,
            'arrow',
          ),
        ],
      ),
    ],
  )
const fleetPage = (model: Model, h: H): Html => {
  const agents = model.workspace.agents.filter(agent =>
    `${agent.name} ${agent.category} ${agent.instructions}`
      .toLowerCase()
      .includes(model.search.toLowerCase()),
  )
  const selectedId = Option.getOrElse(model.maybeSelectedAgent, () => '')
  const selected = agents.find(agent => agent.id === selectedId) ?? agents[0]
  return h.div(
    [],
    [
      pageHeading(
        'Agent fleet',
        'Each agent has a role, instructions, and a stage. Agents in the same stage run in parallel.',
        button('Create agent', Message.ClickedNewAgent(), 'primary', h, 'plus'),
        h,
      ),
      h.div(
        [h.Class('fleet-toolbar')],
        [
          search(model, 'Search agents…', h),
          h.span(
            [h.Class('sample-pill')],
            [
              model.executionMode === 'Simulation'
                ? 'SIMULATED EXECUTION'
                : 'PI DURABLE · EXPERIMENTAL',
            ],
          ),
          button(
            'Run enabled agents',
            Message.ClickedLaunch(),
            'outline',
            h,
            'play',
          ),
        ],
      ),
      Array.isArrayEmpty(agents)
        ? empty(
            'No agents found',
            model.search
              ? `Nothing matches “${model.search}”. Try another search or create your own specialist.`
              : 'Create your own specialist.',
            h,
            undefined,
            model.search
              ? button(
                  'Clear search',
                  Message.UpdatedSearch({ value: '' }),
                  'outline',
                  h,
                )
              : undefined,
          )
        : h.div(
            [h.Class('fleet-layout')],
            [
              h.section(
                [h.Class('panel fleet-table-panel')],
                [
                  h.table(
                    [h.Class('fleet-table')],
                    [
                      h.thead(
                        [],
                        [
                          h.tr(
                            [],
                            [
                              h.th([], ['On']),
                              h.th([], ['Agent']),
                              h.th([], ['Stage']),
                              h.th([], ['Role']),
                            ],
                          ),
                        ],
                      ),
                      h.tbody(
                        [],
                        agents.map(agent =>
                          h.keyed('tr')(
                            agent.id,
                            [
                              h.Class(
                                `${agent.id === selected?.id ? 'is-current' : ''} ${agent.enabled ? '' : 'is-disabled'}`,
                              ),
                            ],
                            [
                              h.td([], [agentToggle(agent, h)]),
                              h.td(
                                [],
                                [
                                  h.button(
                                    [
                                      h.Type('button'),
                                      h.Class('artifact-button'),
                                      h.AriaPressed(
                                        String(agent.id === selected?.id),
                                      ),
                                      h.OnClick(
                                        Message.SelectedAgent({ id: agent.id }),
                                      ),
                                    ],
                                    [
                                      h.strong([], [agent.name]),
                                      h.span(
                                        [h.Class('muted small-text')],
                                        [agent.category],
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                              h.td([h.Class('mono')], [stageLabel(agent)]),
                              h.td(
                                [h.Class('muted agent-role')],
                                [agent.description],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              selected ? agentDetail(selected, h) : h.empty,
            ],
          ),
    ],
  )
}

const severityChip = (severity: Severity, h: H): Html =>
  h.span([h.Class(`severity-chip ${severity.toLowerCase()}`)], [severity])

interface FindingSource {
  readonly runId: string
  readonly agentId: string
  readonly text: string
  readonly status: string | undefined
  readonly source: string
  readonly target: string
}

const findingPreview = (finding: FindingSource, h: H): Html => {
  const summary = summarizeFinding(finding.text, finding.status)
  const meta = [
    finding.target,
    summary.findings
      ? `${summary.findings} finding${summary.findings === 1 ? '' : 's'}`
      : '',
    summary.tables
      ? `${summary.tables} table${summary.tables === 1 ? '' : 's'}`
      : '',
  ]
    .filter(part => part.length > 0)
    .join(' · ')
  return h.button(
    [
      h.Type('button'),
      h.Class('task-output finding-preview'),
      h.Attribute('aria-haspopup', 'dialog'),
      h.Attribute('aria-controls', 'finding-drawer'),
      h.AriaLabel(`Open finding from ${finding.source}: ${summary.title}`),
      h.OnClick(
        Message.ClickedFinding({
          runId: finding.runId,
          agentId: finding.agentId,
        }),
      ),
    ],
    [
      h.span(
        [h.Class('finding-preview-head')],
        [
          severityChip(summary.severity, h),
          h.strong([h.Class('finding-preview-title')], [summary.title]),
        ],
      ),
      meta ? h.span([h.Class('finding-preview-meta mono')], [meta]) : h.empty,
      summary.preview
        ? h.span([h.Class('finding-preview-text')], [summary.preview])
        : h.empty,
      h.span(
        [h.Class('finding-preview-more')],
        ['Open finding', icon('arrow', h)],
      ),
    ],
  )
}

const traceOutputStep = (task: Task): readonly [string, string, Level] => {
  const summary = summarizeFinding(task.output, task.status)
  const blocks = markdownBlocks(task.output).length
  return [
    'output',
    `${summary.title} · ${blocks} block${blocks === 1 ? '' : 's'} · ${(task.output.length / 1024).toFixed(1)} KB`,
    severityLevel(summary.severity),
  ]
}

const runFilters = ['All', 'Running', 'Failed', 'Review'] as const

const runMatches = (model: Model, run: Run): boolean =>
  model.runFilter === 'All'
    ? true
    : model.runFilter === 'Running'
      ? run.status === 'Running' || run.status === 'Paused'
      : model.runFilter === 'Failed'
        ? run.status === 'Failed' ||
          run.tasks.some(task => task.status === 'Failed')
        : model.workspace.approvals.some(
            approval =>
              approval.runId === run.id && approval.status === 'Pending',
          )

const runListMeta = (model: Model, run: Run): string => {
  const failed = run.tasks.filter(task => task.status === 'Failed').length
  const findings = model.workspace.approvals.filter(
    approval => approval.runId === run.id,
  ).length
  return [
    run.targetId,
    run.execution._tag === 'Simulation' ? 'Simulation' : 'Pi Durable',
    `${run.tasks.length} agents`,
    failed ? `${failed} failed` : '',
    findings ? `${findings} finding${findings === 1 ? '' : 's'}` : '',
  ]
    .filter(part => part.length > 0)
    .join(' · ')
}

interface OpenFinding {
  readonly runId: string
  readonly agentId: string
}

const findingPanel = (
  model: Model,
  { runId, agentId }: OpenFinding,
  isClosing: boolean,
  h: H,
): Html => {
  const run = model.workspace.runs.find(candidate => candidate.id === runId)
  const task = run?.tasks.find(candidate => candidate.agentId === agentId)
  const agentName =
    run?.agents.find(candidate => candidate.id === agentId)?.name ??
    model.workspace.agents.find(candidate => candidate.id === agentId)?.name ??
    (agentId === 'review' ? 'Review coordinator' : agentId)
  const text = findingText(model.workspace, runId, agentId)
  const summary = summarizeFinding(text, task?.status)
  const ordered = run ? findingTasks(run) : []
  const position = ordered.findIndex(candidate => candidate.agentId === agentId)
  const approval = model.workspace.approvals.find(
    candidate =>
      candidate.runId === runId &&
      candidate.agentId === agentId &&
      candidate.status === 'Pending',
  )
  const staged = approval
    ? model.stagedDecisions.find(item => item.id === approval.id)
    : undefined
  const meta = [
    agentName,
    run && task ? `Stage 0${agentWave(run, task) + 1}` : '',
    run?.targetId ?? '',
    runId,
    task?.status ?? '',
    task?.session._tag === 'Pi' ? `Pi session ${task.session.id}` : '',
  ]
    .filter(part => part.length > 0)
    .join(' · ')
  return h.aside(
    [
      h.Id('finding-drawer'),
      h.Class('finding-drawer'),
      h.Role('complementary'),
      h.AriaLabelledBy('finding-title'),
      ...(isClosing
        ? [h.DataAttribute('state', 'closing'), h.Inert(true)]
        : []),
    ],
    [
      h.header(
        [h.Class('finding-drawer-head')],
        [
          h.div(
            [h.Class('finding-drawer-top')],
            [
              h.p(
                [h.Class('eyebrow')],
                [
                  position >= 0
                    ? `AGENT OUTPUT · ${position + 1} OF ${ordered.length}`
                    : 'AGENT OUTPUT',
                ],
              ),
              h.div(
                [h.Class('finding-drawer-actions')],
                [
                  ordered.length > 1
                    ? button(
                        'Previous',
                        Message.SteppedFinding({ direction: 'Previous' }),
                        'ghost small',
                        h,
                      )
                    : h.empty,
                  ordered.length > 1
                    ? button(
                        'Next',
                        Message.SteppedFinding({ direction: 'Next' }),
                        'ghost small',
                        h,
                      )
                    : h.empty,
                  text
                    ? button(
                        model.isFindingSourceShown ? 'Rendered' : 'Markdown',
                        Message.ToggledFindingSource(),
                        'ghost small',
                        h,
                      )
                    : h.empty,
                  text
                    ? button(
                        'Copy',
                        Message.ClickedCopyFinding(),
                        'ghost small',
                        h,
                      )
                    : h.empty,
                  iconButton(
                    'close',
                    'Close finding',
                    Message.ClosedFinding(),
                    h,
                  ),
                ],
              ),
            ],
          ),
          h.div(
            [h.Class('finding-drawer-title')],
            [
              severityChip(summary.severity, h),
              h.h2([h.Id('finding-title')], [summary.title || agentName]),
            ],
          ),
          h.p([h.Class('finding-drawer-meta mono')], [meta]),
        ],
      ),
      h.div(
        [h.Class('finding-drawer-body')],
        [
          text
            ? model.isFindingSourceShown
              ? h.pre([h.Class('finding-source')], [text])
              : h.div([h.Class('markdown-body')], markdownView(text, h))
            : h.p([h.Class('muted')], ['No output was recorded.']),
        ],
      ),
      h.footer(
        [h.Class('finding-drawer-foot')],
        approval
          ? [
              h.span(
                [],
                [
                  staged
                    ? `${staged.decision === 'Approved' ? 'Approve' : 'Dismiss'} staged. Submit it from Engineer review.`
                    : 'Pending your review. Nothing is applied until you approve it.',
                ],
              ),
              button(
                'Dismiss',
                Message.StagedApprovalDecision({
                  id: approval.id,
                  decision: 'Rejected',
                }),
                staged?.decision === 'Rejected'
                  ? 'danger small'
                  : 'ghost small',
                h,
              ),
              button(
                'Approve',
                Message.StagedApprovalDecision({
                  id: approval.id,
                  decision: 'Approved',
                }),
                staged?.decision === 'Approved'
                  ? 'primary small'
                  : 'outline small',
                h,
              ),
            ]
          : [
              h.span(
                [],
                [
                  'Findings are proposals. Nothing is applied until you approve it.',
                ],
              ),
            ],
      ),
    ],
  )
}

const findingDrawer = (model: Model, h: H): Html =>
  Option.match(model.maybeOpenFinding, {
    onSome: open => findingPanel(model, open, false, h),
    onNone: () =>
      Option.match(model.maybeClosingFinding, {
        onNone: () => h.empty,
        onSome: closing => findingPanel(model, closing, true, h),
      }),
  })

const taskCard = (run: Run, task: Task, h: H): Html => {
  const agent = run.agents.find(candidate => candidate.id === task.agentId)
  return h.keyed('article')(
    task.agentId,
    [
      h.Id(taskAnchor(run, task.agentId)),
      h.Class(`run-task ${task.status.toLowerCase()}`),
    ],
    [
      h.span(
        [h.Class(`task-step ${task.status.toLowerCase()}`)],
        [
          icon(
            task.status === 'Completed'
              ? 'check'
              : task.status === 'Running'
                ? 'activity'
                : 'clock',
            h,
          ),
        ],
      ),
      h.div(
        [h.Class('task-content')],
        [
          h.div(
            [h.Class('task-heading')],
            [
              h.h3([], [agent?.name ?? task.agentId]),
              badge(
                run.status === 'Paused' && task.status === 'Running'
                  ? 'Paused'
                  : task.status,
                h,
              ),
            ],
          ),
          h.p(
            [h.Class('small-text muted')],
            [agent?.category ?? 'Custom agent'],
          ),
          task.output
            ? isLongFinding(task.output)
              ? findingPreview(
                  {
                    runId: run.id,
                    agentId: task.agentId,
                    text: task.output,
                    status: task.status,
                    source: agent?.name ?? task.agentId,
                    target: run.targetId,
                  },
                  h,
                )
              : h.p([h.Class('task-output')], [task.output])
            : h.p(
                [h.Class('task-waiting')],
                [
                  task.status === 'Running' && run.status === 'Running'
                    ? 'Checking the connected system…'
                    : run.status === 'Cancelled'
                      ? 'Run cancelled; this check did not complete.'
                      : task.status === 'Running'
                        ? 'Execution paused.'
                        : 'Waiting for the previous stage.',
                ],
              ),
        ],
      ),
    ],
  )
}
const levelIcon = (level: Level): string =>
  level === 'error' ? 'alert' : level === 'warn' ? 'help' : 'check'

const runSummaryStrip = (model: Model, run: Run, h: H): Html => {
  const summary = runSummary(model.workspace, run)
  const runApprovals = model.workspace.approvals.filter(
    approval => approval.runId === run.id,
  )
  const firstFinding =
    runApprovals.find(approval => approval.status === 'Pending') ??
    runApprovals[0]
  const firstFailed = run.tasks.find(task => task.status === 'Failed')
  const open = (agentId: string | undefined): Message | undefined =>
    agentId === undefined
      ? undefined
      : Message.ClickedFinding({ runId: run.id, agentId })
  const cells: ReadonlyArray<readonly [string, string, Message | undefined]> = [
    ['Status', run.status, undefined],
    ['Agents', `${summary.done}/${summary.total} completed`, undefined],
    ['Failed', String(summary.failed), open(firstFailed?.agentId)],
    [
      'Findings',
      `${summary.findings}${summary.pendingFindings ? ` · ${summary.pendingFindings} pending` : ''}`,
      open(firstFinding?.agentId),
    ],
    ['Stage', summary.stage, undefined],
    [
      'Executor',
      run.execution._tag === 'Simulation'
        ? 'Local simulation'
        : 'Workers AI · Pi Durable',
      undefined,
    ],
  ]
  return h.dl(
    [h.Class('run-summary'), h.AriaLabel('Run summary')],
    cells.map(([label, value, maybeMessage]) =>
      h.keyed('div')(
        label,
        [h.Class('run-summary-cell')],
        [
          h.dt([], [label]),
          h.dd(
            [],
            [
              maybeMessage
                ? h.button(
                    [
                      h.Type('button'),
                      h.Class('summary-link'),
                      h.OnClick(maybeMessage),
                    ],
                    [value],
                  )
                : value,
            ],
          ),
        ],
      ),
    ),
  )
}

const failedCard = (run: Run, h: H): Html => {
  const failed = run.tasks.find(task => task.status === 'Failed')
  if (!failed) {
    return h.empty
  }
  const name =
    run.agents.find(agent => agent.id === failed.agentId)?.name ??
    failed.agentId
  return h.a(
    [
      h.Class('failed-card'),
      h.Role('alert'),
      h.Href(`#${taskAnchor(run, failed.agentId)}`),
    ],
    [
      icon('alert', h),
      h.div(
        [],
        [
          h.strong([], [`${name} failed`]),
          h.p(
            [h.Class('mono small-text')],
            [
              summarizeFinding(failed.output, failed.status).title ||
                'No output was recorded.',
            ],
          ),
        ],
      ),
    ],
  )
}

const runViewToggle = (model: Model, h: H): Html =>
  h.div(
    [
      h.Class('segmented run-view-toggle'),
      h.Role('group'),
      h.AriaLabel('Run view'),
    ],
    RunView.literals.map(view =>
      h.keyed('button')(
        view,
        [
          h.Type('button'),
          h.Class(model.runView === view ? 'active' : ''),
          h.AriaPressed(String(model.runView === view)),
          h.OnClick(Message.SelectedRunView({ view })),
        ],
        [view],
      ),
    ),
  )

const sortedTasks = (run: Run): ReadonlyArray<Task> =>
  Array.sort(
    run.tasks,
    Order.mapInput(Order.Number, (task: Task) => agentWave(run, task)),
  )

const timelineView = (run: Run, h: H): Html =>
  h.div(
    [h.Class('run-timeline'), h.Role('table'), h.AriaLabel('Stage timeline')],
    [
      h.div(
        [h.Class('timeline-row timeline-head'), h.Role('row')],
        [
          h.span([h.Role('columnheader')], ['Agent']),
          ...stageNames.map((name, wave) =>
            h.keyed('span')(
              name,
              [h.Role('columnheader'), h.Class('mono')],
              [`0${wave + 1} ${name}`],
            ),
          ),
        ],
      ),
      ...sortedTasks(run).map(task => {
        const wave = agentWave(run, task)
        const name =
          run.agents.find(agent => agent.id === task.agentId)?.name ??
          task.agentId
        return h.keyed('div')(
          task.agentId,
          [h.Class('timeline-row'), h.Role('row')],
          [
            h.a(
              [
                h.Role('rowheader'),
                h.Href(`#${taskAnchor(run, task.agentId)}`),
              ],
              [name],
            ),
            ...stageNames.map((stage, index) =>
              h.keyed('span')(
                stage,
                [
                  h.Role('cell'),
                  h.Class(
                    index < wave
                      ? 'timeline-cell waiting'
                      : index === wave
                        ? `timeline-cell bar ${task.status.toLowerCase()}`
                        : 'timeline-cell',
                  ),
                ],
                [index === wave ? task.status : index < wave ? 'waiting' : ''],
              ),
            ),
          ],
        )
      }),
      h.p(
        [h.Class('muted small-text timeline-note')],
        [
          'Axis is execution stage, not wall-clock time. Agents wait for earlier stages; the critical path is the longest-running agent in each stage.',
        ],
      ),
    ],
  )

const traceView = (run: Run, h: H): Html =>
  h.div(
    [h.Class('run-trace')],
    sortedTasks(run).map(task => {
      const name =
        run.agents.find(agent => agent.id === task.agentId)?.name ??
        task.agentId
      const steps: ReadonlyArray<readonly [string, string, Level]> = [
        ['queued', `Queued in stage 0${agentWave(run, task) + 1}`, 'info'],
        [
          'dispatch',
          task.session._tag === 'Pi'
            ? `Pi session ${task.session.id}`
            : task.status === 'Queued'
              ? 'Waiting for dispatch'
              : run.execution._tag === 'Simulation'
                ? 'Local simulation step'
                : 'Dispatched',
          'info',
        ],
        ...(task.output.trim() ? [traceOutputStep(task)] : []),
        [
          'status',
          task.status,
          task.status === 'Failed'
            ? 'error'
            : task.status === 'Cancelled'
              ? 'warn'
              : 'info',
        ],
      ]
      return h.keyed('section')(
        task.agentId,
        [h.Class('trace-agent')],
        [
          h.h4([], [name]),
          h.ol(
            [],
            steps.map(([key, text, level]) =>
              h.keyed('li')(
                key,
                [h.Class(`trace-step ${level}`)],
                [
                  h.span(
                    [h.Class('trace-kind mono')],
                    [key.startsWith('output') ? 'output' : key],
                  ),
                  key === 'output'
                    ? h.button(
                        [
                          h.Type('button'),
                          h.Class('trace-output'),
                          h.OnClick(
                            Message.ClickedFinding({
                              runId: run.id,
                              agentId: task.agentId,
                            }),
                          ),
                        ],
                        [text, icon('arrow', h)],
                      )
                    : h.span([], [text]),
                ],
              ),
            ),
          ),
        ],
      )
    }),
  )

const annotationsPanel = (model: Model, run: Run, h: H): Html => {
  const notes = runAnnotations(model.workspace, run)
  return h.section(
    [h.Class('run-annotations')],
    [
      h.h3([], [`Annotations · ${notes.length}`]),
      notes.length === 0
        ? h.p(
            [h.Class('muted small-text')],
            ['No errors, warnings or findings yet.'],
          )
        : h.ul(
            [],
            notes.map(note =>
              h.keyed('li')(
                note.id,
                [h.Class(`annotation ${note.level}`)],
                [
                  h.button(
                    [
                      h.Type('button'),
                      h.Class('annotation-link'),
                      h.OnClick(
                        Message.ClickedFinding({
                          runId: run.id,
                          agentId: note.agentId,
                        }),
                      ),
                    ],
                    [
                      icon(levelIcon(note.level), h),
                      h.strong([], [note.title]),
                      h.span([h.Class('muted')], [note.detail]),
                    ],
                  ),
                ],
              ),
            ),
          ),
    ],
  )
}

const logPanel = (model: Model, run: Run, h: H): Html => {
  const lines = runLog(model.workspace, run)
  const query = model.runLogQuery.trim().toLowerCase()
  const shown = query
    ? lines.filter(
        line =>
          line.text.toLowerCase().includes(query) ||
          line.source.toLowerCase().includes(query),
      )
    : lines
  const errors = lines.filter(line => line.level === 'error').length
  const warnings = lines.filter(line => line.level === 'warn').length
  return h.section(
    [h.Class('run-log')],
    [
      h.div(
        [h.Class('run-log-head')],
        [
          h.h3([], ['Log']),
          h.span(
            [h.Class('log-count error')],
            [`${errors} ${errors === 1 ? 'error' : 'errors'}`],
          ),
          h.span(
            [h.Class('log-count warn')],
            [`${warnings} ${warnings === 1 ? 'warning' : 'warnings'}`],
          ),
          h.input([
            h.Class('log-search'),
            h.Type('search'),
            h.AriaLabel('Find in log'),
            h.Placeholder('Find in log'),
            h.Value(model.runLogQuery),
            h.OnInput(value => Message.UpdatedRunLogQuery({ value })),
          ]),
          h.span(
            [h.Class('muted small-text mono')],
            [`${shown.length}/${lines.length} lines`],
          ),
        ],
      ),
      h.ol(
        [h.Class('log-lines mono')],
        shown.map(line =>
          h.keyed('li')(
            line.id,
            [h.Class(`log-line ${line.level}`)],
            [
              h.span(
                [h.Class('log-source'), h.Title(line.source)],
                [line.source],
              ),
              h.span([], [line.text]),
            ],
          ),
        ),
      ),
    ],
  )
}

const runDetail = (model: Model, run: Run, h: H): Html => {
  const completed = run.tasks.filter(task => task.status === 'Completed').length
  return h.section(
    [h.Class('panel run-detail')],
    [
      h.div(
        [h.Class('panel-heading')],
        [
          h.div(
            [],
            [
              h.p(
                [h.Class('mono muted small-text')],
                [run.id, ' · ', run.targetId],
              ),
              h.h2([], [run.title]),
            ],
          ),
          badge(run.status, h),
        ],
      ),
      runSummaryStrip(model, run, h),
      failedCard(run, h),
      h.div(
        [h.Class('run-control-bar')],
        [
          h.span([], [`${completed} of ${run.tasks.length} agents completed`]),
          h.div(
            [h.Class('run-controls')],
            [
              run.status === 'Running'
                ? button(
                    run.execution._tag === 'Cloudflare'
                      ? 'Hold next stage'
                      : 'Pause run',
                    Message.ClickedPauseRun({ id: run.id }),
                    'outline small',
                    h,
                    'pause',
                  )
                : run.status === 'Paused'
                  ? button(
                      'Resume run',
                      Message.ClickedResumeRun({ id: run.id }),
                      'outline small',
                      h,
                      'play',
                    )
                  : h.empty,
              ['Running', 'Paused', 'Cancelling'].includes(run.status)
                ? button(
                    run.status === 'Cancelling'
                      ? 'Retry cancellation'
                      : 'Cancel run',
                    Message.ClickedCancelRun({ id: run.id }),
                    'outline small',
                    h,
                  )
                : h.empty,
              run.execution._tag === 'Cloudflare'
                ? button(
                    'Reconnect',
                    Message.ClickedReconnectRun({ id: run.id }),
                    'outline small',
                    h,
                  )
                : h.empty,
              run.execution._tag === 'Cloudflare' && run.status === 'Paused'
                ? button(
                    'Retry dispatch',
                    Message.ClickedRetryCloudflareDispatch({ id: run.id }),
                    'ghost small',
                    h,
                  )
                : h.empty,
              ['Running', 'Paused', 'Cancelling'].includes(run.status)
                ? h.empty
                : button(
                    'Re-run all',
                    Message.ClickedRerun({ id: run.id, scope: 'All' }),
                    'outline small',
                    h,
                    'play',
                  ),
              !['Running', 'Paused', 'Cancelling'].includes(run.status) &&
              run.tasks.some(task => task.status === 'Failed')
                ? button(
                    `Re-run ${run.tasks.filter(task => task.status === 'Failed').length} failed`,
                    Message.ClickedRerun({ id: run.id, scope: 'Failed' }),
                    'danger small',
                    h,
                    'alert',
                  )
                : h.empty,
            ],
          ),
        ],
      ),
      h.div(
        [h.Class('progress-track')],
        [
          h.div([
            h.Style({ width: `${(completed / run.tasks.length) * 100}%` }),
          ]),
        ],
      ),
      h.div(
        [h.Class('simulation-notice')],
        [
          icon('help', h),
          run.execution._tag === 'Simulation'
            ? 'Local simulation · Dependency-based checks, not LLM inference. No connected tools are modified.'
            : run.execution._tag === 'Preparing'
              ? 'Preparing a durable Pi run. No model call has been dispatched yet.'
              : 'Workers AI → AI Gateway → experimental Pi Durable. Runs can continue with this tab closed. Hold stops the next stage; cancel aborts sessions. Findings require human review.',
        ],
      ),
      runViewToggle(model, h),
      model.runView === 'Timeline'
        ? timelineView(run, h)
        : model.runView === 'Trace'
          ? traceView(run, h)
          : h.div(
              [h.Class('stage-timeline')],
              stageNames.map((name, wave) => {
                const tasks = run.tasks.filter(
                  task =>
                    (run.agents.find(agent => agent.id === task.agentId)
                      ?.wave ?? 0) === wave,
                )
                const done = tasks.filter(
                  task => task.status === 'Completed',
                ).length
                const state = Array.isArrayEmpty(tasks)
                  ? 'idle'
                  : done === tasks.length
                    ? 'completed'
                    : tasks.some(task => task.status === 'Failed')
                      ? 'failed'
                      : tasks.some(task => task.status === 'Running')
                        ? 'running'
                        : 'queued'
                return h.keyed('section')(
                  name,
                  [
                    h.Class(`stage-column ${state}`),
                    h.AriaLabel(`Stage ${wave + 1} · ${name}`),
                  ],
                  [
                    h.header(
                      [h.Class('stage-column-head')],
                      [
                        h.span([h.Class('mono')], [`0${wave + 1}`]),
                        h.strong([], [name]),
                        h.span(
                          [h.Class('mono muted')],
                          [`${done}/${tasks.length}`],
                        ),
                      ],
                    ),
                    ...(Array.isArrayEmpty(tasks)
                      ? [
                          h.p(
                            [h.Class('muted small-text stage-empty')],
                            ['No enabled agents in this stage.'],
                          ),
                        ]
                      : tasks.map(task => taskCard(run, task, h))),
                  ],
                )
              }),
            ),
      h.div(
        [h.Class('run-inspector')],
        [annotationsPanel(model, run, h), logPanel(model, run, h)],
      ),
      run.status === 'Completed'
        ? h.div(
            [h.Class('run-approvals')],
            [
              h.h3([], ['Engineer review']),
              approvals(
                model,
                model.workspace.approvals.filter(
                  approval => approval.runId === run.id,
                ),
                h,
              ),
            ],
          )
        : h.empty,
    ],
  )
}
const runsPage = (model: Model, h: H): Html => {
  const selected = Option.getOrElse(
    model.maybeSelectedRun,
    () => model.workspace.runs[0]?.id ?? '',
  )
  const run = model.workspace.runs.find(item => item.id === selected)
  return h.div(
    [],
    [
      pageHeading(
        'Runs',
        'Each run snapshots the workspace, executes stage by stage, and ends in human review.',
        button('New fleet run', Message.ClickedLaunch(), 'primary', h, 'play'),
        h,
      ),
      h.div(
        [h.Class('runs-layout')],
        [
          h.section(
            [h.Class('panel run-list')],
            [
              h.div(
                [h.Class('panel-heading')],
                [
                  h.h2([], ['Fleet runs']),
                  h.span(
                    [h.Class('count-pill')],
                    [String(model.workspace.runs.length)],
                  ),
                ],
              ),
              Array.isReadonlyArrayEmpty(model.workspace.runs)
                ? h.empty
                : h.div(
                    [
                      h.Class('run-filter'),
                      h.Role('group'),
                      h.AriaLabel('Filter runs'),
                    ],
                    runFilters.map(filter =>
                      h.keyed('button')(
                        filter,
                        [
                          h.Type('button'),
                          h.Class(
                            `run-filter-option${model.runFilter === filter ? ' selected' : ''}`,
                          ),
                          h.AriaPressed(String(model.runFilter === filter)),
                          h.OnClick(Message.SelectedRunFilter({ filter })),
                        ],
                        [filter === 'Review' ? 'Needs review' : filter],
                      ),
                    ),
                  ),
              ...model.workspace.runs
                .filter(item => runMatches(model, item))
                .map(item =>
                  h.keyed('button')(
                    item.id,
                    [
                      h.Class(
                        `run-list-item ${item.id === selected ? 'selected' : ''} ${item.tasks.some(task => task.status === 'Failed') ? 'has-failed' : ''}`,
                      ),
                      h.OnClick(Message.SelectedRun({ id: item.id })),
                    ],
                    [
                      h.div(
                        [],
                        [
                          h.span([h.Class('mono muted')], [item.id]),
                          badge(item.status, h),
                        ],
                      ),
                      h.strong([], [item.title]),
                      h.span(
                        [h.Class('small-text muted')],
                        [runListMeta(model, item)],
                      ),
                    ],
                  ),
                ),
              Array.isReadonlyArrayEmpty(model.workspace.runs)
                ? empty('No runs yet', 'Runs appear here once launched.', h)
                : model.workspace.runs.some(item => runMatches(model, item))
                  ? h.empty
                  : h.p(
                      [h.Class('muted small-text run-filter-empty')],
                      ['No runs match this filter.'],
                    ),
            ],
          ),
          run
            ? runDetail(model, run, h)
            : h.section(
                [h.Class('panel first-run')],
                [
                  ghostLayout('run', h),
                  h.h2([], ['Start a fleet run']),
                  h.p(
                    [],
                    [
                      'Impact, coverage, budget, and safety agents check one artifact together. Their findings wait for your review.',
                    ],
                  ),
                  button(
                    'Launch your first run',
                    Message.ClickedLaunch(),
                    'primary',
                    h,
                    'play',
                  ),
                ],
              ),
        ],
      ),
      h.section(
        [h.Class('panel audit-panel')],
        [
          h.div(
            [h.Class('panel-heading')],
            [
              h.h2([], ['Workspace audit trail']),
              h.span(
                [h.Class('muted small-text')],
                ['Local, reviewable history'],
              ),
            ],
          ),
          ...model.workspace.events
            .slice(0, 8)
            .map((event, index) =>
              h.div(
                [h.Class('audit-row')],
                [
                  h.span([h.Class('audit-dot')]),
                  h.p([], [event]),
                  h.span(
                    [h.Class('mono muted small-text')],
                    [`#${model.workspace.events.length - index}`],
                  ),
                ],
              ),
            ),
        ],
      ),
    ],
  )
}

const cloudflareModeLabels: Record<Model['cloudflareAiMode'], string> = {
  WorkersAI: 'Local backend · Workers AI',
  Mock: 'Local backend · mock model',
  Locked: 'Local backend locked',
  Unavailable: 'No local backend',
  Unknown: 'Checking…',
}
const cloudflareModeLabel = (model: Model): string =>
  cloudflareModeLabels[model.cloudflareAiMode]
const cloudflareCredentialsPanel = (model: Model, h: H): Html => {
  const canSave =
    validCloudflareAccountId(model.cloudflareAccountId) &&
    validCloudflareToken(model.cloudflareTokenDraft)
  const canTest =
    validCloudflareAccountId(model.cloudflareAccountId) &&
    (validCloudflareToken(model.cloudflareTokenDraft) ||
      model.hasStoredCloudflareToken)
  const testing = Option.exists(
    model.maybeCloudflareTest,
    test => test.state === 'Testing',
  )
  return h.section(
    [h.Class('panel credentials-panel')],
    [
      h.div(
        [h.Class('credentials-heading')],
        [
          h.div(
            [],
            [
              h.p([h.Class('eyebrow')], ['Workers AI · this browser only']),
              h.h2([], ['Cloudflare credentials']),
            ],
          ),
          h.span(
            [
              h.Class(
                `badge ${model.cloudflareAiMode === 'WorkersAI' ? 'positive' : 'neutral'}`,
              ),
            ],
            [cloudflareModeLabel(model)],
          ),
        ],
      ),
      h.p(
        [],
        [
          'Stored only in this browser (localStorage), never in the workspace or exported packages. The local backend (',
          h.code([], ['bun run dev:local']),
          ') keeps it in memory and calls ',
          Option.match(model.maybeExecutorStatus, {
            onNone: () => 'Workers AI',
            onSome: status => status.model,
          }),
          ' through your AI Gateway. Without a token, use Simulation.',
        ],
      ),
      ...(model.cloudflareAiMode === 'Locked'
        ? [
            h.p(
              [h.Class('credentials-note')],
              [
                'Unlock first: ',
                h.a([h.Href('/api/unlock')], ['sign in']),
                ' with username stream and the access token printed by dev:local.',
              ],
            ),
          ]
        : []),
      h.form(
        [
          h.Class('credentials-form'),
          h.OnSubmit(Message.SubmittedCloudflareCredentials()),
        ],
        [
          h.label(
            [h.Class('form-field')],
            [
              h.span([], ['Account ID']),
              h.input([
                h.Type('text'),
                h.Value(model.cloudflareAccountId),
                h.OnInput(value =>
                  Message.UpdatedCloudflareAccountId({ value }),
                ),
                h.Autocomplete('off'),
                h.Spellcheck(false),
                h.Placeholder('32-character Cloudflare account ID'),
              ]),
            ],
          ),
          h.label(
            [h.Class('form-field')],
            [
              h.span([], ['API token']),
              h.input([
                h.Type('password'),
                h.Value(model.cloudflareTokenDraft),
                h.OnInput(value => Message.UpdatedCloudflareToken({ value })),
                h.Autocomplete('new-password'),
                h.Spellcheck(false),
                h.Placeholder(
                  model.hasStoredCloudflareToken
                    ? 'Saved in this browser · enter a new token to replace it'
                    : 'Token with Workers AI and AI Gateway permissions',
                ),
              ]),
            ],
          ),
          h.div(
            [h.Class('credentials-actions')],
            [
              h.button(
                [
                  h.Type('submit'),
                  h.Class('button primary'),
                  h.Disabled(!canSave),
                ],
                ['Save to this browser'],
              ),
              canSave
                ? h.empty
                : h.span(
                    [h.Class('credentials-result')],
                    ['Enter a valid account ID and API token to save.'],
                  ),
              ...(model.hasStoredCloudflareToken
                ? [
                    button(
                      'Forget saved token',
                      Message.ClickedForgetCloudflareCredentials(),
                      'outline',
                      h,
                    ),
                  ]
                : []),
            ],
          ),
          h.div(
            [h.Class('credentials-test')],
            [
              h.button(
                [
                  h.Type('button'),
                  h.Class('button outline'),
                  h.Disabled(!canTest || testing),
                  h.OnClick(Message.ClickedTestCloudflareCredentials()),
                ],
                [testing ? 'Testing…' : 'Test connection'],
              ),
              Option.match(model.maybeCloudflareTest, {
                onNone: () =>
                  h.span(
                    [h.Class('credentials-result')],
                    [
                      model.cloudflareTokenDraft
                        ? 'Tests the token you entered with one short prompt.'
                        : 'Tests the saved token with one short prompt.',
                    ],
                  ),
                onSome: test =>
                  h.span(
                    [
                      h.Class(`credentials-result ${test.state.toLowerCase()}`),
                      h.Role('status'),
                    ],
                    [
                      test.state === 'Testing'
                        ? 'Sending a test prompt through AI Gateway…'
                        : `${test.state === 'Passed' ? 'Passed' : 'Failed'}${test.latencyMs ? ` · ${(test.latencyMs / 1000).toFixed(1)} s` : ''} — ${test.detail}`,
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
const integrationsPage = (model: Model, h: H): Html => {
  const integrations = [
    {
      name: 'GitHub',
      icon: 'github',
      color: 'neutral',
      description:
        'Connect code changes, pull requests, and engineering issues.',
      type: 'Code & collaboration',
    },
    {
      name: 'Linear',
      icon: 'layers',
      color: 'violet',
      description:
        'Turn issues and project updates into agent workflow triggers.',
      type: 'Planning & delivery',
    },
    {
      name: 'CAD & simulation',
      icon: 'box',
      color: 'blue',
      description:
        'Keep design revisions, models, and simulation evidence in context.',
      type: 'Engineering tools',
    },
    {
      name: 'SharePoint',
      icon: 'file',
      color: 'teal',
      description:
        'Link specifications, reviews, and documents to the systems graph.',
      type: 'Documents & knowledge',
    },
    {
      name: 'Cloudflare Workers AI',
      icon: 'agent',
      color: 'mint',
      description:
        'Workers AI models through AI Gateway, with experimental durable Pi sessions in SQLite Durable Objects.',
      type: 'Agent execution',
    },
    {
      name: 'Custom executor',
      icon: 'plug',
      color: 'orange',
      description:
        'Bring your own harness, model provider, or internal orchestration service.',
      type: 'Agent execution',
    },
  ]
  return h.div(
    [],
    [
      pageHeading(
        'Integrations',
        'Execution backends and tool connectors. Only the Cloudflare executor is implemented.',
        h.empty,
        h,
      ),
      h.div(
        [h.Class('integration-banner')],
        [
          icon('shield', h),
          h.div(
            [],
            [
              h.strong(
                [],
                [
                  'Cloudflare execution works today. GitHub, Linear and other write connectors are previews.',
                ],
              ),
              h.p(
                [],
                [
                  'Live inference requires a configured, authenticated Worker and an existing AI Gateway. For the local demo backend, a Cloudflare token can be saved in this browser below. Agent tools only read the run snapshot.',
                ],
              ),
            ],
          ),
        ],
      ),
      cloudflareCredentialsPanel(model, h),
      h.div(
        [h.Class('agent-grid integrations-grid')],
        integrations.map(item =>
          h.keyed('article')(
            item.name,
            [h.Class('integration-card')],
            [
              h.div(
                [h.Class('agent-card-top')],
                [
                  h.span(
                    [h.Class(`agent-icon large ${item.color}`)],
                    [icon(item.icon, h)],
                  ),
                  h.span(
                    [h.Class('badge neutral')],
                    [
                      item.name === 'Cloudflare Workers AI'
                        ? Option.match(model.maybeExecutorStatus, {
                            onNone: () => 'Setup required',
                            onSome: status =>
                              status.state === 'Ready'
                                ? 'Worker ready'
                                : 'Setup required',
                          })
                        : 'Not connected',
                    ],
                  ),
                ],
              ),
              h.p([h.Class('eyebrow')], [item.type]),
              h.h2([], [item.name]),
              h.p([], [item.description]),
              h.button(
                [
                  h.Type('button'),
                  h.Class('button outline small'),
                  h.AriaLabel(`${item.name} connection details`),
                  h.OnClick(Message.ClickedIntegration({ name: item.name })),
                ],
                ['Details', icon('arrow', h)],
              ),
            ],
          ),
        ),
      ),
      h.section(
        [h.Class('panel adapter-panel')],
        [
          h.h2([], ['A clean boundary for real execution.']),
          h.p(
            [],
            [
              'The Foldkit model owns orchestration state. A server-side executor should own credentials, tool permissions, live agent dispatch, retries, and durable run events. Human approvals stay explicit.',
            ],
          ),
          h.div(
            [h.Class('adapter-flow')],
            [
              h.span([], ['Tool event']),
              icon('arrow', h),
              h.span([], ['Systems graph']),
              icon('arrow', h),
              h.span([], ['Agent fleet']),
              icon('arrow', h),
              h.span([], ['Human review']),
            ],
          ),
          button(
            'Export the current workspace',
            Message.ClickedExport(),
            'text-button',
            h,
            'download',
          ),
        ],
      ),
    ],
  )
}

const inspector = (model: Model, h: H, isClosing = false): Html =>
  Option.match(model.maybeSelectedNode, {
    onNone: () => h.empty,
    onSome: id => {
      const item = model.workspace.requirements.find(
        candidate => candidate.id === id,
      )
      if (!item) {
        return h.empty
      }
      const affected = downstream(model.workspace.requirements, item.id)
      const upstream = model.workspace.requirements.filter(parent =>
        parent.links.includes(id),
      )
      return h.aside(
        [
          h.Class('inspector'),
          h.AriaLabel('Artifact inspector'),
          ...(isClosing
            ? [h.DataAttribute('state', 'closing'), h.Inert(true)]
            : []),
        ],
        [
          h.div(
            [h.Class('inspector-top')],
            [
              h.p([h.Class('eyebrow')], ['ARTIFACT DETAILS']),
              iconButton(
                'close',
                'Close artifact inspector',
                Message.ClosedInspector(),
                h,
              ),
            ],
          ),
          h.p(
            [h.Class('mono muted')],
            [item.id, ` · REVISION ${item.revision}`],
          ),
          h.h2([], [item.title]),
          badge(item.status, h),
          h.p([h.Class('inspector-description')], [item.description]),
          h.dl(
            [h.Class('inspector-meta')],
            [
              h.dt([], ['Owner']),
              h.dd([], [item.owner]),
              h.dt([], ['Type']),
              h.dd([], [item.kind]),
              h.dt([], ['Downstream impact']),
              h.dd([], [`${affected.length} artifacts`]),
            ],
          ),
          button(
            'Edit artifact',
            Message.ClickedEditRequirement({ id }),
            'outline full-width',
            h,
            'file',
          ),
          h.h3([], ['Upstream dependencies']),
          Array.isArrayEmpty(upstream)
            ? h.p([h.Class('muted small-text')], ['No upstream dependencies.'])
            : h.div(
                [],
                upstream.map(parent =>
                  button(
                    `${parent.id} · ${parent.title}`,
                    Message.SelectedNode({ id: parent.id }),
                    'inspector-link',
                    h,
                    'arrow',
                  ),
                ),
              ),
          h.h3([], ['Downstream impact']),
          Array.isReadonlyArrayEmpty(affected)
            ? h.p(
                [h.Class('muted small-text')],
                ['No downstream dependencies.'],
              )
            : h.div(
                [],
                affected.map(link => {
                  const linked = model.workspace.requirements.find(
                    candidate => candidate.id === link,
                  )
                  return button(
                    `${link} · ${linked?.title ?? 'Artifact'}`,
                    Message.SelectedNode({ id: link }),
                    'inspector-link',
                    h,
                    'arrow',
                  )
                }),
              ),
          h.div(
            [h.Class('inspector-bottom')],
            [
              button(
                'Run impact analysis',
                Message.ClickedLaunch(),
                'primary full-width',
                h,
                'agent',
              ),
            ],
          ),
        ],
      )
    },
  })

const fieldError = (model: Model, value: string, text: string): string =>
  model.hasInvalidSubmit && !value.trim() ? text : ''
const field = (
  label: string,
  value: string,
  message: (value: string) => Message,
  h: H,
  multiline = false,
  error?: string,
): Html => {
  const errorId = `field-${label.toLowerCase().replace(/\W+/g, '-')}-error`
  const isInvalid = error !== undefined && error.length > 0
  const validation =
    error === undefined
      ? [h.Required(true)]
      : isInvalid
        ? [h.AriaInvalid(true), h.AriaDescribedBy(errorId)]
        : []
  return h.label(
    [h.Class('form-field')],
    [
      h.span([], [label]),
      multiline
        ? h.textarea([
            h.Value(value),
            h.OnInput(message),
            h.Rows(4),
            ...validation,
          ])
        : h.input([
            h.Type('text'),
            h.Value(value),
            h.OnInput(message),
            ...validation,
          ]),
      isInvalid
        ? h.span([h.Class('field-error'), h.Id(errorId)], [error])
        : h.empty,
    ],
  )
}
const launchPreview = (
  model: Model,
  targetId: string,
  scope: LaunchScope,
  h: H,
): Html => {
  const estimate = launchEstimate(
    launchScopeRequirements(workingRequirements(model), targetId, scope),
    model.workspace.agents,
  )
  const cells: ReadonlyArray<readonly [string, string]> = [
    ['Agents', String(estimate.agents)],
    ['Stages', String(estimate.stages)],
    ['Artifacts', String(estimate.artifacts)],
    [
      'Context / agent',
      `≈${estimate.contextTokens.toLocaleString('en-US')} tok`,
    ],
    [
      'Input, minimum',
      `≈${estimate.minimumInputTokens.toLocaleString('en-US')} tok`,
    ],
    [
      'Output cap',
      model.executionMode === 'Simulation' ? 'No model calls' : '2,048 tok',
    ],
  ]
  return h.div(
    [h.Class('launch-preview')],
    [
      h.dl(
        [h.Class('run-summary'), h.AriaLabel('Launch estimate')],
        cells.map(([label, value]) =>
          h.keyed('div')(
            label,
            [h.Class('run-summary-cell')],
            [h.dt([], [label]), h.dd([h.Class('mono')], [value])],
          ),
        ),
      ),
      h.p(
        [h.Class('muted small-text')],
        [
          model.executionMode === 'Simulation'
            ? 'No model calls. No cost.'
            : 'Estimate ≈ 4 chars/token. Cost depends on Workers AI pricing.',
        ],
      ),
    ],
  )
}

const modalContent = (model: Model, h: H): Html =>
  Modal.match(model.modal, {
    ArtifactFields: () =>
      h.div(
        [],
        [
          h.p([h.Class('eyebrow')], ['TABLE FIELDS']),
          h.h2([h.Id('dialog-title')], ['Choose visible fields']),
          h.p(
            [h.Class('subtitle')],
            ['Artifact identifiers and edit actions are always visible.'],
          ),
          ...ArtifactField.literals.map(column =>
            h.keyed('label')(
              column,
              [h.Class('field-checkbox')],
              [
                h.input([
                  h.Type('checkbox'),
                  h.AriaLabel(column),
                  h.Checked(model.visibleArtifactFields.includes(column)),
                  h.OnClick(Message.ToggledArtifactField({ field: column })),
                ]),
                column,
              ],
            ),
          ),
          h.div(
            [h.Class('modal-footer')],
            [button('Done', Message.ClosedModal(), 'primary', h)],
          ),
        ],
      ),
    WorkspaceImporter: editor =>
      h.form(
        [h.OnSubmit(Message.SubmittedImport())],
        [
          h.p([h.Class('eyebrow')], ['LOCAL WORKSPACE DATA']),
          h.h2([h.Id('dialog-title')], ['Import workspace']),
          h.p(
            [h.Class('subtitle')],
            [
              'Paste exported workspace JSON. This replaces all current local data; export a backup first. Do not include credentials. Unfinished runs are paused.',
            ],
          ),
          field(
            'Workspace JSON',
            editor.jsonText,
            jsonText => Message.UpdatedImportJson({ jsonText }),
            h,
            true,
          ),
          h.div(
            [h.Class('modal-footer')],
            [
              button('Cancel', Message.ClosedModal(), 'ghost', h),
              h.button(
                [
                  h.Type('submit'),
                  h.Class('button primary'),
                  h.Disabled(model.storage === 'Loading'),
                ],
                ['Replace local workspace'],
              ),
            ],
          ),
        ],
      ),
    CommandPalette: palette => {
      const items = paletteItems(
        model,
        model.workspace.requirements,
        palette.query,
      )
      return h.form(
        [h.Class('palette'), h.OnSubmit(Message.SubmittedPalette())],
        [
          h.h2(
            [h.Id('dialog-title'), h.Class('visually-hidden')],
            ['Command palette'],
          ),
          h.div(
            [h.Class('palette-input')],
            [
              icon('search', h),
              h.input([
                h.Id('palette-input'),
                h.Type('text'),
                h.Role('combobox'),
                h.AriaLabel('Search commands'),
                h.AriaExpanded(true),
                h.AriaControls('palette-list'),
                h.AriaActiveDescendant(`palette-option-${palette.index}`),
                h.Placeholder('Jump to a page, artifact, agent, or action…'),
                h.Value(palette.query),
                h.OnInput(value => Message.UpdatedPaletteQuery({ value })),
                h.OnKeyDownPreventDefault(key =>
                  key === 'ArrowDown'
                    ? Option.some(Message.MovedPaletteHighlight({ delta: 1 }))
                    : key === 'ArrowUp'
                      ? Option.some(
                          Message.MovedPaletteHighlight({ delta: -1 }),
                        )
                      : Option.none(),
                ),
              ]),
              h.kbd([], ['esc']),
            ],
          ),
          Array.isReadonlyArrayEmpty(items)
            ? h.p(
                [h.Class('palette-empty muted')],
                [
                  'No commands match. Try a page name, an artifact ID, or “new”.',
                ],
              )
            : h.ul(
                [
                  h.Id('palette-list'),
                  h.Class('palette-list'),
                  h.Role('listbox'),
                  h.AriaLabel('Commands'),
                ],
                items.map((item, index) =>
                  h.keyed('li')(
                    item.id,
                    [
                      h.Id(`palette-option-${index}`),
                      h.Role('option'),
                      h.AriaSelected(index === palette.index),
                      h.Class(
                        `palette-item ${index === palette.index ? 'highlighted' : ''} ${items[index - 1]?.group === item.group ? '' : 'group-start'}`,
                      ),
                      h.Attribute('data-group', item.group),
                      h.OnClick(Message.ChosePaletteItem({ index })),
                    ],
                    [
                      h.span(
                        [h.Class('palette-text')],
                        [
                          h.span([h.Class('palette-label')], [item.label]),
                          h.span([h.Class('palette-path mono')], [item.path]),
                        ],
                      ),
                      h.span(
                        [h.Class('palette-hint')],
                        [item.hint ? h.kbd([], [item.hint]) : h.empty],
                      ),
                    ],
                  ),
                ),
              ),
          h.div(
            [h.Class('palette-footer mono')],
            [
              h.span(
                [],
                [
                  `${items.length} ${items.length === 1 ? 'result' : 'results'}`,
                ],
              ),
              h.span([], [h.kbd([], ['↑']), h.kbd([], ['↓']), ' navigate']),
              h.span([], [h.kbd([], ['↵']), ' open']),
              h.span([], [h.kbd([], ['esc']), ' close']),
              h.button(
                [
                  h.Type('button'),
                  h.Class('text-button'),
                  h.OnClick(Message.ClickedShortcuts()),
                ],
                [h.kbd([], ['?']), ' all shortcuts'],
              ),
            ],
          ),
        ],
      )
    },
    ViewEditor: editor =>
      h.form(
        [h.OnSubmit(Message.SubmittedView())],
        [
          h.p([h.Class('eyebrow')], ['SAVED VIEW']),
          h.h2([h.Id('dialog-title')], ['Save current view']),
          h.p(
            [h.Class('subtitle')],
            [
              'Saves the filter, search, grouping, and sort. It appears under Views in the sidebar.',
            ],
          ),
          field(
            'View name',
            editor.name,
            value => Message.UpdatedViewName({ value }),
            h,
          ),
          h.div(
            [h.Class('chip-row')],
            [
              chip('Filter', model.filter, h),
              chip('Group', model.groupBy, h),
              chip(
                'Sort',
                Option.getOrElse(model.maybeSortKey, (): string => 'None'),
                h,
              ),
              model.search ? chip('Search', model.search, h) : h.empty,
            ],
          ),
          h.div(
            [h.Class('modal-footer')],
            [
              button('Cancel', Message.ClosedModal(), 'ghost', h),
              h.button(
                [h.Type('submit'), h.Class('button primary')],
                ['Save view'],
              ),
            ],
          ),
        ],
      ),
    Shortcuts: () =>
      h.div(
        [],
        [
          h.p([h.Class('eyebrow')], ['KEYBOARD']),
          h.h2([h.Id('dialog-title')], ['Keyboard shortcuts']),
          h.dl(
            [h.Class('shortcut-list')],
            shortcutRows.flatMap(([keys, label]) => [
              h.dt(
                [],
                keys.map(key => h.kbd([], [key])),
              ),
              h.dd([], [label]),
            ]),
          ),
          h.div(
            [h.Class('modal-footer')],
            [button('Done', Message.ClosedModal(), 'primary', h)],
          ),
        ],
      ),
    Closed: () => h.empty,
    BranchEditor: editor =>
      h.form(
        [h.OnSubmit(Message.SubmittedBranch())],
        [
          h.p([h.Class('eyebrow')], ['EXPLORE A CHANGE']),
          h.h2([h.Id('dialog-title')], ['Create a branch']),
          h.p(
            [h.Class('subtitle')],
            [
              'Start from Base. Edits stay isolated until you review and merge them.',
            ],
          ),
          field(
            'Branch name',
            editor.title,
            value => Message.UpdatedTitle({ value }),
            h,
          ),
          h.div(
            [h.Class('modal-footer')],
            [
              button('Cancel', Message.ClosedModal(), 'ghost', h),
              h.button(
                [h.Type('submit'), h.Class('button primary')],
                ['Create branch'],
              ),
            ],
          ),
        ],
      ),
    RequirementEditor: editor =>
      h.form(
        [h.OnSubmit(Message.SubmittedRequirement())],
        [
          h.p([h.Class('eyebrow')], ['SYSTEM OF RECORD']),
          h.h2(
            [h.Id('dialog-title')],
            [editor.id ? 'Edit artifact' : 'Create an artifact'],
          ),
          h.p(
            [h.Class('subtitle')],
            ['Give the work a clear place in your connected system.'],
          ),
          field(
            'Title',
            editor.title,
            value => Message.UpdatedTitle({ value }),
            h,
            false,
            fieldError(model, editor.title, 'Add a title.'),
          ),
          field(
            'Description',
            editor.description,
            value => Message.UpdatedDescription({ value }),
            h,
            true,
            fieldError(model, editor.description, 'Add a description.'),
          ),
          h.div(
            [h.Class('form-grid')],
            [
              field(
                'Owner',
                editor.owner,
                value => Message.UpdatedOwner({ value }),
                h,
                false,
                fieldError(model, editor.owner, 'Add an owner.'),
              ),
              h.label(
                [h.Class('form-field')],
                [
                  h.span([], ['Artifact type']),
                  h.select(
                    [
                      h.Value(editor.kind),
                      h.AriaLabel('Artifact type'),
                      h.OnChange(value => Message.UpdatedKind({ value })),
                    ],
                    Requirement.fields.kind.literals.map(kind =>
                      h.option([h.Value(kind)], [kind]),
                    ),
                  ),
                ],
              ),
            ],
          ),
          h.div(
            [h.Class('form-field')],
            [
              h.span([], ['Downstream links']),
              h.p(
                [h.Class('muted small-text')],
                ['Select artifacts that depend on this one.'],
              ),
              h.div(
                [h.Class('link-picker')],
                model.workspace.requirements
                  .filter(item => item.id !== editor.id)
                  .map(item =>
                    h.keyed('label')(
                      item.id,
                      [h.Class('link-option')],
                      [
                        h.input([
                          h.Type('checkbox'),
                          h.Checked(editor.links.includes(item.id)),
                          h.OnChange(() =>
                            Message.ToggledLink({ id: item.id }),
                          ),
                        ]),
                        h.span(
                          [],
                          [
                            h.span([h.Class('mono muted')], [item.id]),
                            item.title,
                          ],
                        ),
                      ],
                    ),
                  ),
              ),
            ],
          ),
          h.div(
            [h.Class('modal-footer')],
            [
              button('Cancel', Message.ClosedModal(), 'ghost', h),
              h.button(
                [h.Type('submit'), h.Class('button primary')],
                ['Save artifact'],
              ),
            ],
          ),
        ],
      ),
    AgentEditor: editor =>
      h.form(
        [h.OnSubmit(Message.SubmittedAgent())],
        [
          h.p([h.Class('eyebrow')], ['AGENT CONFIGURATION']),
          h.h2(
            [h.Id('dialog-title')],
            [
              editor.id
                ? 'Configure your specialist'
                : 'Create your own specialist',
            ],
          ),
          h.p(
            [h.Class('subtitle')],
            ['A clear role. Explicit instructions. Human oversight.'],
          ),
          field(
            'Agent name',
            editor.name,
            value => Message.UpdatedTitle({ value }),
            h,
          ),
          field(
            'Instructions',
            editor.instructions,
            value => Message.UpdatedInstructions({ value }),
            h,
            true,
          ),
          h.div(
            [h.Class('form-field')],
            [
              h.span([], ['Execution stage']),
              h.div(
                [
                  h.Class('run-controls'),
                  h.Role('group'),
                  h.AriaLabel('Execution stage'),
                ],
                AgentWave.literals.map(wave =>
                  h.keyed('button')(
                    String(wave),
                    [
                      h.Type('button'),
                      h.Class(
                        `button small ${editor.wave === wave ? 'primary' : 'outline'}`,
                      ),
                      h.AriaPressed(String(editor.wave === wave)),
                      h.OnClick(Message.SelectedAgentWave({ wave })),
                    ],
                    [
                      `${wave + 1} · ${['Discover', 'Evaluate', 'Coordinate'][wave]}`,
                    ],
                  ),
                ),
              ),
            ],
          ),
          h.div(
            [h.Class('simulation-notice')],
            [
              icon('help', h),
              'Workers AI follows these instructions against the run snapshot. Simulation uses deterministic checks, not your prompt. Neither mode exposes external write tools.',
            ],
          ),
          h.div(
            [h.Class('modal-footer')],
            [
              button('Cancel', Message.ClosedModal(), 'ghost', h),
              h.button(
                [h.Type('submit'), h.Class('button primary')],
                ['Save agent'],
              ),
            ],
          ),
        ],
      ),
    RunLauncher: editor =>
      h.form(
        [h.OnSubmit(Message.SubmittedRun())],
        [
          h.p([h.Class('eyebrow')], ['FLEET RUN']),
          h.h2([h.Id('dialog-title')], ['Launch your fleet']),
          h.p(
            [h.Class('subtitle')],
            ['Choose the artifact to analyze and confirm the execution mode.'],
          ),
          field(
            'Run title',
            editor.title,
            value => Message.UpdatedTitle({ value }),
            h,
          ),
          h.label(
            [h.Class('form-field')],
            [
              h.span([], ['Source artifact']),
              h.select(
                [
                  h.Value(editor.targetId),
                  h.OnChange(id => Message.UpdatedRunTarget({ id })),
                ],
                model.workspace.requirements.map(item =>
                  h.option([h.Value(item.id)], [`${item.id} · ${item.title}`]),
                ),
              ),
            ],
          ),
          h.label(
            [h.Class('form-field')],
            [
              h.span([], ['Scope']),
              h.select(
                [
                  h.AriaLabel('Scope'),
                  h.Value(editor.scope),
                  h.OnChange(value =>
                    Message.SelectedLaunchScope({
                      scope: value === 'Impact' ? 'Impact' : 'Workspace',
                    }),
                  ),
                ],
                LaunchScope.literals.map(scope =>
                  h.keyed('option')(
                    scope,
                    [h.Value(scope)],
                    [
                      scope === 'Workspace'
                        ? 'Whole workspace'
                        : 'Sample · source artifact and downstream only',
                    ],
                  ),
                ),
              ),
            ],
          ),
          launchPreview(model, editor.targetId, editor.scope, h),
          h.div(
            [h.Class('chip-row'), h.AriaLabel('Run metadata')],
            [
              chip('Source', editor.targetId, h),
              chip(
                'Scope',
                editor.scope === 'Workspace' ? 'Whole workspace' : 'Sample',
                h,
              ),
              chip(
                'Agents',
                String(
                  model.workspace.agents.filter(agent => agent.enabled).length,
                ),
                h,
              ),
              chip(
                'Stages',
                String(
                  Array.dedupe(
                    model.workspace.agents
                      .filter(agent => agent.enabled)
                      .map(agent => agent.wave),
                  ).length,
                ),
                h,
              ),
              chip(
                'Branch',
                Option.getOrElse(model.maybeActiveBranch, () => 'Base'),
                h,
              ),
              chip(
                'Mode',
                model.executionMode === 'Simulation'
                  ? 'Simulation'
                  : 'Workers AI',
                h,
              ),
            ],
          ),
          h.label(
            [h.Class('form-field')],
            [
              h.span([], ['Execution mode']),
              h.select(
                [
                  h.AriaLabel('Execution mode'),
                  h.Value(model.executionMode),
                  h.OnChange(value =>
                    Message.SelectedExecutionMode({
                      mode:
                        value === 'Simulation' ? 'Simulation' : 'Cloudflare',
                    }),
                  ),
                ],
                ExecutionMode.literals.map(mode =>
                  h.keyed('option')(
                    mode,
                    [h.Value(mode)],
                    [
                      mode === 'Cloudflare'
                        ? 'Workers AI · Pi Durable (experimental)'
                        : 'Local simulation · no model calls',
                    ],
                  ),
                ),
              ),
            ],
          ),
          model.executionMode === 'Cloudflare'
            ? h.div(
                [h.Class('executor-status')],
                [
                  h.p(
                    [h.Class('small-text muted')],
                    [
                      Option.match(model.maybeExecutorStatus, {
                        onNone: () =>
                          'Worker unavailable or not yet checked. Configure it before launching.',
                        onSome: status =>
                          `${status.state === 'Ready' ? 'Worker ready' : status.state === 'Locked' ? 'Worker locked — unlock to launch' : 'Worker needs server configuration'} · ${status.model} · Gateway: ${status.gateway}`,
                      }),
                    ],
                  ),
                  Option.match(model.maybeExecutorError, {
                    onNone: () => h.empty,
                    onSome: error =>
                      h.p(
                        [h.Class('inline-error'), h.Role('alert')],
                        [icon('alert', h), error],
                      ),
                  }),
                  h.div(
                    [h.Class('executor-actions')],
                    [
                      button(
                        'Check Worker',
                        Message.ClickedProbeExecutor(),
                        'outline small',
                        h,
                      ),
                      h.a(
                        [
                          h.Href('/api/unlock'),
                          h.Class('button outline small'),
                        ],
                        ['Unlock Worker'],
                      ),
                    ],
                  ),
                ],
              )
            : h.empty,
          h.div(
            [h.Class('launch-stages')],
            [0, 1, 2].map(wave =>
              h.div(
                [h.Class('launch-stage')],
                [
                  h.span([h.Class('stage-number')], [String(wave + 1)]),
                  h.div(
                    [],
                    [
                      h.strong(
                        [],
                        [
                          ['Discover', 'Evaluate', 'Coordinate'][wave] ??
                            'Stage',
                        ],
                      ),
                      h.p(
                        [],
                        [
                          model.workspace.agents
                            .filter(
                              agent => agent.enabled && agent.wave === wave,
                            )
                            .map(agent => agent.name)
                            .join(' + ') || 'No enabled agents in this stage',
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          model.executionMode === 'Simulation'
            ? pausePoints(model, h)
            : h.empty,
          h.div(
            [h.Class('simulation-notice')],
            [
              icon('shield', h),
              model.executionMode === 'Simulation'
                ? 'Local simulation. Agents run in parallel within each stage. Your workspace is snapshotted; nothing changes without human review.'
                : 'Live, billable Workers AI inference through AI Gateway. Up to 8 agents, 2,048 output tokens per generation, and a 10-minute deadline. The artifact snapshot and findings are sent to Cloudflare. Read-only tools; no artifact writes.',
            ],
          ),
          h.div(
            [h.Class('modal-footer')],
            [
              h.label(
                [h.Class('field-checkbox launch-another')],
                [
                  h.input([
                    h.Type('checkbox'),
                    h.Checked(editor.launchAnother),
                    h.OnChange(() => Message.ToggledLaunchAnother()),
                  ]),
                  'Keep open',
                ],
              ),
              button('Cancel', Message.ClosedModal(), 'ghost', h),
              h.button(
                [
                  h.Type('submit'),
                  h.Class('button primary'),
                  h.Disabled(
                    model.storage === 'Loading' ||
                      (model.executionMode === 'Cloudflare' &&
                        (model.storage !== 'Ready' ||
                          Option.match(model.maybeExecutorStatus, {
                            onNone: () => true,
                            onSome: status => status.state !== 'Ready',
                          }))) ||
                      !model.workspace.agents.some(agent => agent.enabled),
                  ),
                ],
                [
                  icon('play', h),
                  `Run ${model.workspace.agents.filter(agent => agent.enabled).length} agents`,
                ],
              ),
            ],
          ),
        ],
      ),
    IntegrationDetails: ({ name }) =>
      h.div(
        [],
        [
          h.p([h.Class('eyebrow')], ['CONNECTION DETAILS']),
          h.h2([h.Id('dialog-title')], [name]),
          h.p(
            [h.Class('subtitle')],
            [
              name === 'Cloudflare Workers AI'
                ? 'The server adapter is implemented using AI Gateway and the experimental durable Pi harness.'
                : 'This external write connector is not implemented.',
            ],
          ),
          h.div(
            [h.Class('connection-requirements')],
            [
              h.h3([], ['What a live connection needs']),
              h.p(
                [],
                [
                  name === 'Cloudflare Workers AI'
                    ? '1. Configure AI_GATEWAY_ID with an existing Cloudflare gateway.'
                    : '1. A server-side adapter with scoped authentication.',
                ],
              ),
              h.p(
                [],
                [
                  name === 'Cloudflare Workers AI'
                    ? '2. Set STREAM_ACCESS_TOKEN as a Worker secret; unlock as username stream.'
                    : '2. Artifact mappings and change-event ingestion.',
                ],
              ),
              h.p(
                [],
                [
                  name === 'Cloudflare Workers AI'
                    ? '3. Deploy through your official release pipeline, or run the Worker locally with Workers AI authorization.'
                    : '3. A durable executor for dispatch, cancellation, and run events.',
                ],
              ),
              h.p([], ['4. Explicit approval before any external write.']),
            ],
          ),
          h.div(
            [h.Class('simulation-notice')],
            [
              icon('shield', h),
              'No OAuth request is made and no credentials are stored by this preview.',
            ],
          ),
          h.div(
            [h.Class('modal-footer')],
            [button('Got it', Message.ClosedModal(), 'primary', h)],
          ),
        ],
      ),
  })
const modal = (model: Model, h: H, isClosing = false): Html =>
  model.modal._tag === 'Closed'
    ? h.empty
    : h.div(
        [
          h.Class(
            `modal-backdrop ${model.modal._tag === 'CommandPalette' ? 'palette-backdrop' : ''}`,
          ),
          ...(isClosing
            ? [h.DataAttribute('state', 'closing'), h.Inert(true)]
            : []),
          h.OnKeyDownPreventDefault(key =>
            key === 'Escape'
              ? Option.some(Message.ClosedModal())
              : Option.none(),
          ),
        ],
        [
          h.button([
            h.Class('modal-dismiss-layer'),
            h.AriaLabel('Close dialog'),
            h.OnClick(Message.ClosedModal()),
            h.Tabindex(-1),
          ]),
          h.div(
            [
              h.Class(
                model.modal._tag === 'CommandPalette'
                  ? 'modal palette-modal'
                  : 'modal',
              ),
              ...(isClosing
                ? [h.AriaHidden(true)]
                : [
                    h.Role('dialog'),
                    h.AriaModal(true),
                    h.AriaLabelledBy('dialog-title'),
                  ]),
            ],
            [
              iconButton('close', 'Close modal', Message.ClosedModal(), h),
              modalContent(model, h),
            ],
          ),
        ],
      )

// VIEW

const markingBanner = (h: H): Html =>
  h.div(
    [
      h.Class('marking-banner'),
      h.Attribute('role', 'note'),
      h.AriaLabel(
        'CUI, specified export controlled. Air-gapped enclave. ITAR-controlled data, authorized U.S. persons only.',
      ),
    ],
    [
      h.strong([h.Class('marking-level')], ['CUI // SP-EXPT']),
      h.span([h.Class('marking-detail')], ['Air-gapped enclave']),
      h.span(
        [h.Class('marking-detail')],
        ['ITAR-controlled · Authorized U.S. persons only'],
      ),
    ],
  )

export const view = (sourceModel: Model, h: H): Document => {
  const model = modifyFields(sourceModel, {
    workspace: workspace =>
      modifyFields(workspace, {
        requirements: () => workingRequirements(sourceModel),
      }),
  })
  return {
    title: `${model.page} · Stream`,
    body: h.div(
      [
        h.Class(
          `app-shell ${model.isSidebarCollapsed ? 'sidebar-collapsed' : ''} ${model.isResizingSidebar ? 'is-resizing' : ''} ${currentOrg.tenant === 'Gov' ? 'has-marking' : ''}`,
        ),
        h.Attribute('style', `--sidebar-width: ${model.sidebarWidth}px`),
      ],
      [
        ...(currentOrg.tenant === 'Gov' ? [markingBanner(h)] : []),
        sidebar(model, h),
        h.div(
          [h.Class('main-shell')],
          [
            topbar(model, h),
            h.main(
              [h.Class('main-content'), h.Id('main')],
              [
                model.page === 'Overview'
                  ? overview(model, h)
                  : model.page === 'Digital twin'
                    ? twinPage(model, h)
                    : model.page === 'Branches'
                      ? branchesPage(sourceModel, h)
                      : model.page === 'Systems graph'
                        ? graphPage(model, h)
                        : model.page === 'Requirements'
                          ? requirementsPage(model, h)
                          : model.page === 'Agent fleet'
                            ? fleetPage(model, h)
                            : model.page === 'Runs'
                              ? runsPage(model, h)
                              : integrationsPage(model, h),
              ],
            ),
          ],
        ),
        Option.isNone(model.maybeSelectedNode)
          ? Option.match(model.maybeClosingNode, {
              onNone: () => h.empty,
              onSome: ({ id }) =>
                inspector(
                  modifyFields(model, {
                    maybeSelectedNode: () => Option.some(id),
                  }),
                  h,
                  true,
                ),
            })
          : inspector(model, h),
        findingDrawer(model, h),
        model.modal._tag === 'Closed'
          ? Option.match(model.maybeClosingModal, {
              onNone: () => h.empty,
              onSome: exit =>
                modal(
                  modifyFields(model, { modal: () => exit.modal }),
                  h,
                  true,
                ),
            })
          : modal(model, h),
        h.div(
          [h.Class('toast-region'), h.Role('status'), h.AriaLive('polite')],
          [
            Option.match(model.maybeToast, {
              onSome: text => toast(model, text, false, h),
              onNone: () =>
                Option.match(model.maybeLeavingToast, {
                  onNone: () => h.empty,
                  onSome: ({ text }) => toast(model, text, true, h),
                }),
            }),
          ],
        ),
      ],
    ),
  }
}

const bannerStatus = (
  model: Model,
): { readonly label: string; readonly tone: string } =>
  model.executionMode === 'Simulation'
    ? { label: 'Simulation · no model calls', tone: 'simulation' }
    : Option.isSome(model.maybeExecutorError) ||
        model.cloudflareAiMode === 'Unavailable'
      ? { label: 'Backend unavailable', tone: 'unavailable' }
      : Option.isNone(model.maybeExecutorStatus)
        ? { label: 'Checking backend…', tone: 'simulation' }
        : { label: 'All systems connected', tone: '' }
const toast = (model: Model, text: string, isLeaving: boolean, h: H): Html =>
  h.keyed('div')(
    text,
    [
      h.Class(`toast ${model.isToastError ? 'error' : ''}`),
      h.Role(model.isToastError ? 'alert' : 'status'),
      ...(isLeaving
        ? [h.DataAttribute('state', 'leaving'), h.Inert(true)]
        : []),
    ],
    [
      icon(model.isToastError ? 'alert' : 'check', h),
      h.p([], [text]),
      model.isToastError &&
      model.executionMode === 'Cloudflare' &&
      Option.isSome(model.maybeExecutorError)
        ? button(
            'Use simulation',
            Message.SelectedExecutionMode({ mode: 'Simulation' }),
            'ghost small toast-action',
            h,
          )
        : h.empty,
      iconButton('close', 'Dismiss notification', Message.DismissedToast(), h),
    ],
  )
