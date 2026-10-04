import { Option } from 'effect'
import { modifyFields } from 'foldkit/struct'
import { describe, expect, it } from 'vitest'

import { groupArtifacts, visibleArtifacts } from './artifact-order'
import { Modal } from './domain'
import {
  impactCounts,
  launchEstimate,
  launchScopeRequirements,
  runLog,
  runSummary,
} from './insights'
import {
  clampSidebarWidth,
  sidebarDefaultWidth,
  sidebarMaxWidth,
  sidebarMinWidth,
} from './layout'
import { type Model, initialModel, motionTransition, update } from './main'
import { Message } from './message'
import { paletteItems } from './palette'

const ready: Model = modifyFields(initialModel, { storage: () => 'Ready' })
const ids = (model: Model): ReadonlyArray<string> =>
  visibleArtifacts(model, model.workspace.requirements).map(item => item.id)

const revisions = (model: Model): ReadonlyArray<number> =>
  visibleArtifacts(model, model.workspace.requirements).map(
    item => item.revision,
  )
const isMonotonic = (
  values: ReadonlyArray<number>,
  direction: 1 | -1,
): boolean =>
  values.every(
    (value, index) =>
      index === 0 || ((values[index - 1] ?? value) - value) * direction <= 0,
  )

describe('workbench interactions', () => {
  it('cycles a column sort through ascending, descending, and unsorted', () => {
    const ascending = update(
      ready,
      Message.ClickedSortColumn({ key: 'Revision' }),
    ).model
    const descending = update(
      ascending,
      Message.ClickedSortColumn({ key: 'Revision' }),
    ).model
    const unsorted = update(
      descending,
      Message.ClickedSortColumn({ key: 'Revision' }),
    ).model
    expect(isMonotonic(revisions(ascending), 1)).toBe(true)
    expect(isMonotonic(revisions(descending), -1)).toBe(true)
    expect(Option.isNone(unsorted.maybeSortKey)).toBe(true)
    expect(ids(unsorted)).toEqual(ids(ready))
  })

  it('applies a bulk status to selected artifacts and records it', () => {
    const [first, second] = ready.workspace.requirements
    const selected = update(
      update(ready, Message.ToggledArtifactSelection({ id: first?.id ?? '' }))
        .model,
      Message.ToggledArtifactSelection({ id: second?.id ?? '' }),
    ).model
    expect(selected.selectedArtifactIds).toHaveLength(2)
    const result = update(
      selected,
      Message.SelectedBulkStatus({ status: 'Needs review' }),
    )
    expect(result.model.selectedArtifactIds).toEqual([])
    const changed = result.model.workspace.requirements.filter(
      item => item.id === first?.id || item.id === second?.id,
    )
    expect(changed.every(item => item.status === 'Needs review')).toBe(true)
    expect(result.commands).toHaveLength(1)
  })

  it('selects every visible artifact, then clears on a second toggle', () => {
    const all = update(ready, Message.ToggledAllArtifacts()).model
    expect(all.selectedArtifactIds).toEqual(ids(ready))
    expect(
      update(all, Message.ToggledAllArtifacts()).model.selectedArtifactIds,
    ).toEqual([])
  })

  it('clamps graph zoom and resets it', () => {
    const zoomed = Array.from({ length: 12 }).reduce<Model>(
      model =>
        update(model, Message.ClickedGraphZoom({ direction: 'In' })).model,
      ready,
    )
    expect(zoomed.graphZoom).toBe(1.6)
    expect(
      update(zoomed, Message.ClickedGraphZoom({ direction: 'Reset' })).model
        .graphZoom,
    ).toBe(1)
  })

  it('opens the palette, filters, and runs the chosen command', () => {
    const opened = update(ready, Message.PressedCommandPalette())
    expect(opened.model.modal._tag).toBe('CommandPalette')
    expect(opened.commands).toHaveLength(1)
    const filtered = update(
      opened.model,
      Message.UpdatedPaletteQuery({ value: 'agent fleet' }),
    ).model
    const items = paletteItems(
      filtered,
      filtered.workspace.requirements,
      'agent fleet',
    )
    expect(items[0]?.label).toBe('Agent fleet')
    const chosen = update(filtered, Message.SubmittedPalette()).model
    expect(chosen.page).toBe('Agent fleet')
    expect(chosen.modal._tag).toBe('Closed')
  })

  it('wraps palette highlight movement', () => {
    const opened = update(ready, Message.PressedCommandPalette()).model
    const moved = update(
      opened,
      Message.MovedPaletteHighlight({ delta: -1 }),
    ).model
    expect(moved.modal).toEqual(
      Modal.CommandPalette({
        query: '',
        index:
          paletteItems(opened, opened.workspace.requirements, '').length - 1,
      }),
    )
  })

  it('moves through artifacts with keyboard shortcuts on Requirements', () => {
    const page = update(
      ready,
      Message.SelectedPage({ page: 'Requirements' }),
    ).model
    const next = update(
      page,
      Message.PressedArtifactShortcut({ action: 'Next' }),
    ).model
    const after = update(
      next,
      Message.PressedArtifactShortcut({ action: 'Next' }),
    ).model
    expect(next.maybeSelectedNode).toEqual(Option.some(ids(page)[0]))
    expect(after.maybeSelectedNode).toEqual(Option.some(ids(page)[1]))
    const toggled = update(
      after,
      Message.PressedArtifactShortcut({ action: 'Toggle' }),
    ).model
    expect(toggled.selectedArtifactIds).toEqual([ids(page)[1]])
  })

  it('keeps Worker probe errors inside the launch dialog', () => {
    const launching = update(ready, Message.ClickedLaunch()).model
    const failed = update(
      launching,
      Message.FailedProbeExecutor({ error: 'Worker unavailable' }),
    ).model
    expect(failed.maybeExecutorError).toEqual(Option.some('Worker unavailable'))
    expect(Option.isNone(failed.maybeToast)).toBe(true)
  })
})

const pendingId = (model: Model): string =>
  model.workspace.approvals.find(item => item.status === 'Pending')?.id ?? ''

describe('mobbin review improvements', () => {
  it('holds approval decisions until the review is submitted', () => {
    const id = pendingId(ready)
    const staged = update(
      ready,
      Message.StagedApprovalDecision({ id, decision: 'Approved' }),
    ).model
    expect(
      staged.workspace.approvals.find(item => item.id === id)?.status,
    ).toBe('Pending')
    expect(staged.viewedApprovalIds).toContain(id)
    const submitted = update(staged, Message.SubmittedReview()).model
    expect(
      submitted.workspace.approvals.find(item => item.id === id)?.status,
    ).toBe('Approved')
    expect(submitted.stagedDecisions).toEqual([])
  })

  it('requires a reason before submitting a dismissal', () => {
    const id = pendingId(ready)
    const staged = update(
      ready,
      Message.StagedApprovalDecision({ id, decision: 'Rejected' }),
    ).model
    const blocked = update(staged, Message.SubmittedReview()).model
    expect(
      blocked.workspace.approvals.find(item => item.id === id)?.status,
    ).toBe('Pending')
    const reasoned = update(
      staged,
      Message.UpdatedDismissReason({ id, value: 'Covered by TST-004' }),
    ).model
    const submitted = update(reasoned, Message.SubmittedReview()).model
    expect(
      submitted.workspace.approvals.find(item => item.id === id)?.status,
    ).toBe('Rejected')
    expect(submitted.workspace.events[0]).toContain('Covered by TST-004')
  })

  it('toggles a staged decision off when clicked twice', () => {
    const id = pendingId(ready)
    const once = update(
      ready,
      Message.StagedApprovalDecision({ id, decision: 'Approved' }),
    ).model
    const twice = update(
      once,
      Message.StagedApprovalDecision({ id, decision: 'Approved' }),
    ).model
    expect(twice.stagedDecisions).toEqual([])
  })

  it('limits a sample launch to the source artifact and its downstream', () => {
    const simulation = modifyFields(ready, {
      executionMode: () => 'Simulation' as const,
    })
    const target = ready.workspace.requirements.find(
      item =>
        launchScopeRequirements(ready.workspace.requirements, item.id, 'Impact')
          .length < ready.workspace.requirements.length,
    )
    if (!target) {
      throw new Error('missing non-root requirement')
    }
    const launched = update(
      update(simulation, Message.ClickedLaunch()).model,
      Message.UpdatedRunTarget({ id: target.id }),
    ).model
    const sampled = update(
      launched,
      Message.SelectedLaunchScope({ scope: 'Impact' }),
    ).model
    const run = update(sampled, Message.SubmittedRun()).model.workspace.runs[0]
    const expected = launchScopeRequirements(
      ready.workspace.requirements,
      target.id,
      'Impact',
    )
    expect(run?.requirements.map(item => item.id)).toEqual(
      expected.map(item => item.id),
    )
    expect(launchEstimate(expected, ready.workspace.agents).artifacts).toBe(
      expected.length,
    )
  })

  it('switches run views and summarizes a run log', () => {
    expect(
      update(ready, Message.SelectedRunView({ view: 'Timeline' })).model
        .runView,
    ).toBe('Timeline')
    const simulation = modifyFields(ready, {
      executionMode: () => 'Simulation' as const,
    })
    const started = update(
      update(simulation, Message.ClickedLaunch()).model,
      Message.SubmittedRun(),
    ).model
    const run = started.workspace.runs[0]
    if (!run) {
      throw new Error('run was not created')
    }
    const lines = runLog(started.workspace, run)
    expect(lines.some(line => line.source === 'Workspace')).toBe(true)
    expect(runSummary(started.workspace, run).total).toBe(run.tasks.length)
  })

  it('counts approval impact without a run snapshot', () => {
    const approval = ready.workspace.approvals[0]
    if (!approval) {
      throw new Error('missing seeded approval')
    }
    const counts = impactCounts(ready.workspace, approval)
    expect(counts.downstream).toBeGreaterThanOrEqual(counts.tests)
    expect(counts.brokenLinks).toBe(0)
  })
})

const sim: Model = modifyFields(ready, {
  executionMode: () => 'Simulation',
})

describe('display, views, and reruns', () => {
  it('groups artifacts and collapses a group', () => {
    const grouped = update(
      ready,
      Message.SelectedGroupBy({ groupBy: 'Status' }),
    ).model
    const groups = groupArtifacts(
      visibleArtifacts(grouped, grouped.workspace.requirements),
      grouped.groupBy,
    )
    expect(groups.length).toBeGreaterThan(1)
    expect(groups.flatMap(group => group.items)).toHaveLength(
      grouped.workspace.requirements.length,
    )
    const key = groups[0]?.key ?? ''
    const collapsed = update(grouped, Message.ToggledGroup({ key })).model
    expect(collapsed.collapsedGroups).toContain(key)
    expect(
      update(collapsed, Message.ToggledGroup({ key })).model.collapsedGroups,
    ).not.toContain(key)
  })

  it('dismisses the setup checklist', () => {
    expect(update(ready, Message.DismissedSetup()).model.isSetupDismissed).toBe(
      true,
    )
  })

  it('resizes the sidebar tree by dragging and keys', () => {
    const pressed = update(ready, Message.PressedTreeHandle()).model
    const started = update(pressed, Message.MovedTreeHandle({ y: 500 })).model
    const dragged = update(started, Message.MovedTreeHandle({ y: 400 })).model
    expect(dragged.sidebarTreeHeight).toBe(ready.sidebarTreeHeight + 100)
    const released = update(dragged, Message.ReleasedTreeHandle()).model
    expect(
      update(released, Message.MovedTreeHandle({ y: 0 })).model
        .sidebarTreeHeight,
    ).toBe(dragged.sidebarTreeHeight)
    expect(
      update(released, Message.PressedTreeHandleKey({ key: 'Home' })).model
        .sidebarTreeHeight,
    ).toBe(96)
  })

  it('assigns an owner to selected artifacts', () => {
    const id = ready.workspace.requirements[0]?.id ?? ''
    const selected = update(
      ready,
      Message.ToggledArtifactSelection({ id }),
    ).model
    const assigned = update(
      selected,
      Message.SelectedBulkOwner({ owner: 'Nadia Park' }),
    ).model
    expect(
      assigned.workspace.requirements.find(item => item.id === id)?.owner,
    ).toBe('Nadia Park')
    expect(assigned.selectedArtifactIds).toEqual([])
  })

  it('keeps a dismissed toast mounted until its exit settles', () => {
    const shown = modifyFields(ready, {
      maybeToast: () => Option.some('Saved'),
    })
    const dismissed = update(shown, Message.DismissedToast())
    expect(Option.isNone(dismissed.model.maybeToast)).toBe(true)
    const leaving = Option.getOrThrow(dismissed.model.maybeLeavingToast)
    expect(leaving.text).toBe('Saved')
    const stale = update(
      dismissed.model,
      Message.CompletedExitMotion({
        surface: 'Toast',
        token: leaving.token - 1,
      }),
    )
    expect(Option.isSome(stale.model.maybeLeavingToast)).toBe(true)
    const settled = update(
      dismissed.model,
      Message.CompletedExitMotion({ surface: 'Toast', token: leaving.token }),
    )
    expect(Option.isNone(settled.model.maybeLeavingToast)).toBe(true)
  })

  it('cancels a closing inspector when a node is reopened', () => {
    const open = update(ready, Message.SelectedNode({ id: 'REQ-001' })).model
    const closed = update(open, Message.ClosedInspector()).model
    expect(Option.map(closed.maybeClosingNode, exit => exit.id)).toEqual(
      Option.some('REQ-001'),
    )
    const reopened = update(closed, Message.SelectedNode({ id: 'REQ-002' }))
    expect(Option.isNone(reopened.model.maybeClosingNode)).toBe(true)
  })

  it('closes a modal with an exit unless the page changes', () => {
    const open = update(ready, Message.ClickedShortcuts()).model
    const closed = update(open, Message.ClosedModal())
    expect(Option.isSome(closed.model.maybeClosingModal)).toBe(true)
    const navigated = update(
      open,
      Message.PressedPageShortcut({ page: 'Runs' }),
    ).model
    expect(Option.isNone(navigated.maybeClosingModal)).toBe(true)
  })

  it('picks view transitions from model changes', () => {
    const runs = modifyFields(ready, { page: () => 'Runs' as const })
    expect(motionTransition(ready, runs)).toEqual({ types: ['page'] })
    expect(motionTransition(ready, ready)).toBe(false)
  })

  it('opens the finding drawer and closes it with an exit state', () => {
    const opened = update(
      ready,
      Message.ClickedFinding({ runId: 'run-1', agentId: 'impact' }),
    )
    expect(opened.model.maybeOpenFinding).toEqual(
      Option.some({ runId: 'run-1', agentId: 'impact' }),
    )
    expect(opened.model.modal._tag).toBe('Closed')
    const closed = update(opened.model, Message.ClosedFinding())
    expect(Option.isNone(closed.model.maybeOpenFinding)).toBe(true)
    expect(Option.isSome(closed.model.maybeClosingFinding)).toBe(true)
    const left = update(opened.model, Message.SelectedPage({ page: 'Runs' }))
    expect(Option.isNone(left.model.maybeOpenFinding)).toBe(true)
  })

  it('filters runs by status', () => {
    const filtered = update(
      ready,
      Message.SelectedRunFilter({ filter: 'Failed' }),
    )
    expect(filtered.model.runFilter).toBe('Failed')
  })

  it('reveals a selected node only on the systems graph page', () => {
    const onGraph = modifyFields(ready, {
      page: () => 'Systems graph' as const,
    })
    const selected = update(onGraph, Message.SelectedNode({ id: 'REQ-001' }))
    expect(selected.model.maybeSelectedNode).toEqual(Option.some('REQ-001'))
    expect(selected.commands).toHaveLength(1)
    const onFiles = modifyFields(ready, { page: () => 'Files' as const })
    expect(
      update(onFiles, Message.SelectedNode({ id: 'REQ-001' })).commands,
    ).toBeUndefined()
  })

  it('bounds, resets, and persists the sidebar width', () => {
    expect(
      update(ready, Message.MovedSidebarHandle({ x: 400 })).model.sidebarWidth,
    ).toBe(ready.sidebarWidth)
    const pressed = update(ready, Message.PressedSidebarHandle()).model
    expect(pressed.isResizingSidebar).toBe(true)
    const wide = update(pressed, Message.MovedSidebarHandle({ x: 2000 })).model
    expect(wide.sidebarWidth).toBe(sidebarMaxWidth)
    const narrow = update(wide, Message.MovedSidebarHandle({ x: 10 })).model
    expect(narrow.sidebarWidth).toBe(sidebarMinWidth)
    const released = update(narrow, Message.ReleasedSidebarHandle())
    expect(released.model.isResizingSidebar).toBe(false)
    expect(released.commands).toHaveLength(1)
    const keyed = update(
      released.model,
      Message.PressedSidebarHandleKey({ key: 'ArrowRight' }),
    )
    expect(keyed.model.sidebarWidth).toBe(sidebarMinWidth + 16)
    expect(keyed.commands).toHaveLength(1)
    expect(
      update(keyed.model, Message.ResetSidebarWidth()).model.sidebarWidth,
    ).toBe(sidebarDefaultWidth)
    expect(
      update(ready, Message.LoadedSidebarWidth({ width: 9999 })).model
        .sidebarWidth,
    ).toBe(sidebarMaxWidth)
    expect(clampSidebarWidth(250.4)).toBe(250)
  })

  it('stores pause points on new simulation runs', () => {
    const paused = update(sim, Message.ToggledPauseAfter({ wave: 0 })).model
    expect(paused.pauseAfter).toEqual([0])
    const launcher = update(paused, Message.ClickedLaunch()).model
    const launched = update(launcher, Message.SubmittedRun()).model
    expect(launched.workspace.runs[0]?.pauseAfter).toEqual([0])
    expect(
      update(paused, Message.ToggledPauseAfter({ wave: 0 })).model.pauseAfter,
    ).toEqual([])
  })

  it('keeps the launcher open when launching another run', () => {
    const launcher = update(sim, Message.ClickedLaunch()).model
    const toggled = update(launcher, Message.ToggledLaunchAnother()).model
    const launched = update(toggled, Message.SubmittedRun()).model
    expect(launched.modal._tag).toBe('RunLauncher')
    expect(launched.workspace.runs).toHaveLength(sim.workspace.runs.length + 1)
  })

  it('re-runs only failed agents without touching approvals', () => {
    const launcher = update(sim, Message.ClickedLaunch()).model
    const launched = update(launcher, Message.SubmittedRun()).model
    const [run, ...rest] = launched.workspace.runs
    if (!run || run.tasks.length < 2) {
      throw new Error('Expected a run with several agents')
    }
    const failedAgent = run.tasks[0]?.agentId ?? ''
    const finished = modifyFields(launched, {
      workspace: workspace =>
        modifyFields(workspace, {
          runs: () => [
            modifyFields(run, {
              status: () => 'Completed',
              tasks: tasks =>
                tasks.map((task, index) =>
                  modifyFields(task, {
                    status: () => (index === 0 ? 'Failed' : 'Completed'),
                  }),
                ),
            }),
            ...rest,
          ],
        }),
    })
    const rerun = update(
      finished,
      Message.ClickedRerun({ id: run.id, scope: 'Failed' }),
    ).model
    const [next] = rerun.workspace.runs
    expect(next?.id).not.toBe(run.id)
    expect(next?.agents.map(agent => agent.id)).toEqual([failedAgent])
    expect(next?.requirements).toEqual(run.requirements)
    expect(rerun.workspace.approvals).toEqual(finished.workspace.approvals)
    expect(
      update(finished, Message.ClickedRerun({ id: run.id, scope: 'All' })).model
        .workspace.runs[0]?.agents,
    ).toHaveLength(run.agents.length)
  })

  it('shows breadcrumb paths and ranks exact palette matches first', () => {
    const items = paletteItems(ready, ready.workspace.requirements, '')
    const artifact = items.find(item => item.id.startsWith('artifact-'))
    expect(artifact?.path).toContain('›')
    expect(items.some(item => item.group === 'Actions')).toBe(true)
    expect(items.some(item => item.group === 'Go to')).toBe(true)
    expect(
      paletteItems(ready, ready.workspace.requirements, 'runs')[0]?.label,
    ).toBe('Runs')
    expect(update(ready, Message.ClickedShortcuts()).model.modal._tag).toBe(
      'Shortcuts',
    )
  })
})
