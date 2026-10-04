import { Array, Order } from 'effect'

import type { Page } from './domain'
import type { Model } from './main'
import { Message } from './message'

export type PaletteGroup = 'Actions' | 'Recent' | 'Go to'

export type PaletteItem = Readonly<{
  id: string
  group: PaletteGroup
  label: string
  path: string
  hint: string
  message: Message
}>

export const pageShortcuts: ReadonlyArray<{ page: Page; key: string }> = [
  { page: 'Files', key: 'F' },
  { page: 'Digital twin', key: 'T' },
  { page: 'Systems graph', key: 'S' },
  { page: 'Requirements', key: 'R' },
  { page: 'Branches', key: 'B' },
  { page: 'Agent fleet', key: 'A' },
  { page: 'Runs', key: 'N' },
]

export const paletteLimit = 40
const program = 'Atlas launch program'

const action = (
  id: string,
  label: string,
  message: Message,
  hint = '',
  path = 'Actions',
): PaletteItem => ({ id, group: 'Actions', label, path, hint, message })

const actions: ReadonlyArray<PaletteItem> = [
  action('action-launch', 'Run agent fleet', Message.ClickedLaunch()),
  action('action-artifact', 'New artifact', Message.ClickedNewRequirement()),
  action('action-agent', 'New agent', Message.ClickedNewAgent()),
  action('action-branch', 'New branch', Message.ClickedNewBranch()),
  action('action-import', 'Import workspace JSON', Message.ClickedImport()),
  action('action-export', 'Export workspace JSON', Message.ClickedExport()),
  action('action-sidebar', 'Toggle sidebar', Message.ToggledSidebar(), '['),
  action(
    'action-shortcuts',
    'Show all keyboard shortcuts',
    Message.ClickedShortcuts(),
    '?',
    'Help',
  ),
]

const contextualActions = (
  model: Model,
  requirements: Model['workspace']['requirements'],
): ReadonlyArray<PaletteItem> => {
  const selected = requirements.find(
    item =>
      model.maybeSelectedNode._tag === 'Some' &&
      item.id === model.maybeSelectedNode.value,
  )
  const pending = model.workspace.approvals.filter(
    item => item.status === 'Pending',
  ).length
  const failedRun = model.workspace.runs.find(
    run =>
      !['Running', 'Paused', 'Cancelling'].includes(run.status) &&
      run.tasks.some(task => task.status === 'Failed'),
  )
  return [
    ...(selected
      ? [
          action(
            'context-analyze',
            `Analyze impact of ${selected.id}`,
            Message.ClickedLaunch(),
            '',
            `${program} › ${selected.kind} › ${selected.id}`,
          ),
        ]
      : []),
    ...(pending > 0
      ? [
          action(
            'context-approvals',
            `Review ${pending} pending ${pending === 1 ? 'approval' : 'approvals'}`,
            Message.SelectedInbox(),
            '',
            'Inbox › Approvals',
          ),
        ]
      : []),
    ...(failedRun
      ? [
          action(
            'context-rerun',
            `Re-run failed agents in ${failedRun.id}`,
            Message.ClickedRerun({ id: failedRun.id, scope: 'Failed' }),
            '',
            `Runs › ${failedRun.id}`,
          ),
        ]
      : []),
  ]
}

export const paletteItems = (
  model: Model,
  requirements: Model['workspace']['requirements'],
  query: string,
): ReadonlyArray<PaletteItem> => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const items: ReadonlyArray<PaletteItem> = [
    ...contextualActions(model, requirements),
    ...actions,
    ...model.workspace.runs.slice(0, 3).map((run): PaletteItem => ({
      id: `recent-${run.id}`,
      group: 'Recent',
      label: `${run.id} · ${run.title}`,
      path: `Runs › ${run.status}`,
      hint: '',
      message: Message.SelectedRun({ id: run.id }),
    })),
    ...pageShortcuts.map(({ page, key }): PaletteItem => ({
      id: `page-${page}`,
      group: 'Go to',
      label: page,
      path: 'Pages',
      hint: `G ${key}`,
      message: Message.SelectedPage({ page }),
    })),
    ...requirements.map((item): PaletteItem => ({
      id: `artifact-${item.id}`,
      group: 'Go to',
      label: `${item.id} · ${item.title}`,
      path: `${program} › ${item.kind} › ${item.id}`,
      hint: '',
      message: Message.SelectedNode({ id: item.id }),
    })),
    ...model.workspace.agents.map((agent): PaletteItem => ({
      id: `agent-${agent.id}`,
      group: 'Go to',
      label: `Configure ${agent.name}`,
      path: `Agent fleet › Stage ${agent.wave + 1}`,
      hint: '',
      message: Message.ClickedEditAgent({ id: agent.id }),
    })),
  ]
  const needle = query.trim().toLowerCase()
  const rank = (item: PaletteItem): number => {
    const label = item.label.toLowerCase()
    return label === needle ? 0 : label.startsWith(needle) ? 1 : 2
  }
  return Array.sort(
    items.filter(item =>
      terms.every(term =>
        `${item.group} ${item.label} ${item.path} ${item.hint}`
          .toLowerCase()
          .includes(term),
      ),
    ),
    Order.mapInput(Order.Number, rank),
  ).slice(0, paletteLimit)
}
