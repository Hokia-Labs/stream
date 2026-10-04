import {
  Command,
  change,
  click,
  expect,
  given,
  label,
  role,
  scene,
  selector,
  submit,
  type,
} from 'foldkit/scene'
import { modifyFields } from 'foldkit/struct'
import { describe, it } from 'vitest'

import { seedWorkspace } from './domain'
import {
  FocusPalette,
  SaveWorkspace,
  ScrollActiveNav,
  WaitForSimulationWave,
  initialModel,
  update,
  view,
} from './main'
import { Message } from './message'

const ready = modifyFields(initialModel, {
  storage: () => 'Ready',
  executionMode: () => 'Simulation',
  hasAcknowledgedConsent: () => true,
})

describe('workspace UI wiring', () => {
  it('filters by discipline and lets table fields be hidden and restored', () => {
    scene(
      { update, view },
      given(ready),
      click(role('button', { name: 'Requirements' })),
      Command.resolve(ScrollActiveNav, Message.CompletedScrollActiveNav()),
      change(role('combobox', { name: 'Discipline view' }), 'Test'),
      expect(selector('tbody')).toContainText('Endurance validation'),
      expect(selector('tbody')).not.toContainText('Power & endurance'),
      change(role('combobox', { name: 'Discipline view' }), 'All artifacts'),
      click(role('button', { name: 'Fields' })),
      click(role('checkbox', { name: 'Owner' })),
      click(role('button', { name: 'Done' })),
      expect(selector('table.hide-owner')).toExist(),
      click(role('button', { name: 'Fields' })),
      click(role('checkbox', { name: 'Owner' })),
      click(role('button', { name: 'Done' })),
      expect(selector('table.hide-owner')).not.toExist(),
    )
  })
  it('imports workspace JSON through the visible replacement confirmation', () => {
    scene(
      { update, view },
      given(ready),
      click(role('button', { name: 'Requirements' })),
      Command.resolve(ScrollActiveNav, Message.CompletedScrollActiveNav()),
      click(role('button', { name: 'Import' })),
      type(label('Workspace JSON'), JSON.stringify(seedWorkspace)),
      click(role('button', { name: 'Replace local workspace' })),
      Command.resolve(SaveWorkspace, Message.CompletedSaveWorkspace()),
      expect(role('dialog')).not.toExist(),
      expect(selector('tbody')).toContainText('Power & endurance'),
    )
  })
  it('switches between table, collapsible tree, and document reader views', () => {
    scene(
      { update, view },
      given(ready),
      click(role('button', { name: 'Requirements' })),
      Command.resolve(ScrollActiveNav, Message.CompletedScrollActiveNav()),
      click(role('button', { name: 'Tree' })),
      expect(selector('.artifact-tree-graph')).toContainText(
        'Endurance validation',
      ),
      click(role('button', { name: 'Toggle Atlas autonomous platform' })),
      expect(selector('.artifact-tree-graph')).not.toContainText(
        'Endurance validation',
      ),
      click(role('button', { name: 'Toggle Atlas autonomous platform' })),
      expect(selector('.artifact-tree-graph')).toContainText(
        'Endurance validation',
      ),
      click(role('button', { name: 'Reader' })),
      expect(selector('.artifact-reader')).toContainText(
        'Battery subsystem shall provide',
      ),
      type(
        role('searchbox', { name: 'Search artifacts…' }),
        'Navigation accuracy',
      ),
      expect(selector('.artifact-reader')).toContainText('Navigation accuracy'),
      expect(selector('.artifact-reader')).not.toContainText(
        'Power & endurance',
      ),
      click(role('button', { name: 'Table' })),
      expect(role('table')).toContainText('Navigation accuracy'),
    )
  })

  it('creates typed systems and merges an isolated branch through the UI', () => {
    scene(
      { update, view },
      given(ready),
      click(role('button', { name: 'Branches' })),
      Command.resolve(ScrollActiveNav, Message.CompletedScrollActiveNav()),
      click(role('button', { name: 'New branch' })),
      type(label('Branch name'), 'Thermal upgrade'),
      submit(selector('form')),
      Command.resolve(SaveWorkspace, Message.CompletedSaveWorkspace()),
      click(role('button', { name: 'Open command palette' })),
      Command.resolve(FocusPalette, Message.CompletedFocusPalette()),
      click(role('option', { name: /New artifact/ })),
      type(label('Title'), 'Thermal subsystem'),
      type(
        label('Description'),
        'Keep payload temperatures within operating limits.',
      ),
      change(role('combobox', { name: 'Artifact type' }), 'System'),
      submit(selector('form')),
      Command.resolve(SaveWorkspace, Message.CompletedSaveWorkspace()),
      expect(role('table')).toContainText('Thermal subsystem'),
      change(role('combobox', { name: 'Active branch' }), ''),
      expect(role('table')).not.toContainText('Thermal subsystem'),
      click(role('button', { name: 'Branches' })),
      Command.resolve(ScrollActiveNav, Message.CompletedScrollActiveNav()),
      expect(selector('.branch-list')).toContainText('1 changed artifacts'),
      expect(selector('.diff-after')).toContainText('Thermal subsystem'),
      click(role('button', { name: 'Approve branch' })),
      Command.resolve(SaveWorkspace, Message.CompletedSaveWorkspace()),
      click(role('button', { name: 'Merge into Base' })),
      Command.resolve(SaveWorkspace, Message.CompletedSaveWorkspace()),
      expect(selector('.branch-list')).toContainText('Merged'),
      click(role('button', { name: 'Requirements' })),
      Command.resolve(ScrollActiveNav, Message.CompletedScrollActiveNav()),
      expect(role('table')).toContainText('Thermal subsystem'),
    )
  })

  it('navigates to requirements and filters the artifact table', () => {
    scene(
      { update, view },
      given(ready),
      click(role('button', { name: 'Requirements' })),
      Command.resolve(ScrollActiveNav, Message.CompletedScrollActiveNav()),
      expect(role('heading', { name: 'Requirements', level: 1 })).toExist(),
      type(role('searchbox', { name: 'Search artifacts…' }), 'Battery'),
      expect(role('table')).toContainText('Battery pack assembly'),
      expect(role('table')).not.toContainText('Navigation accuracy'),
      type(role('searchbox', { name: 'Search artifacts…' }), ''),
      change(role('combobox', { name: 'Filter artifacts' }), 'Test'),
      expect(role('table')).toContainText('Endurance validation'),
      expect(role('table')).not.toContainText('Battery pack assembly'),
    )
  })

  it('creates an artifact through labeled form inputs', () => {
    scene(
      { update, view },
      given(ready),
      click(role('button', { name: 'Requirements' })),
      Command.resolve(ScrollActiveNav, Message.CompletedScrollActiveNav()),
      click(role('button', { name: 'Open command palette' })),
      Command.resolve(FocusPalette, Message.CompletedFocusPalette()),
      click(role('option', { name: /New artifact/ })),
      type(label('Title'), 'Payload integration'),
      type(
        label('Description'),
        'The payload shall connect to the control bus.',
      ),
      submit(selector('form')),
      Command.resolve(SaveWorkspace, Message.CompletedSaveWorkspace()),
      expect(role('table')).toContainText('Payload integration'),
      expect(role('dialog')).not.toExist(),
    )
  })

  it('launches and completes a fleet through the actual view handlers', () => {
    scene(
      { update, view },
      given(modifyFields(ready, { page: () => 'Runs' as const })),
      click(role('button', { name: 'New fleet run' })),
      expect(role('dialog')).toContainText('Local simulation'),
      submit(selector('form')),
      Command.resolveAllExact(
        [SaveWorkspace, Message.CompletedSaveWorkspace()],
        [
          WaitForSimulationWave,
          Message.CompletedSimulationWave({ id: 'RUN-012', token: 0 }),
        ],
        [SaveWorkspace, Message.CompletedSaveWorkspace()],
        [
          WaitForSimulationWave,
          Message.CompletedSimulationWave({ id: 'RUN-012', token: 1 }),
        ],
        [SaveWorkspace, Message.CompletedSaveWorkspace()],
        [
          WaitForSimulationWave,
          Message.CompletedSimulationWave({ id: 'RUN-012', token: 2 }),
        ],
        [SaveWorkspace, Message.CompletedSaveWorkspace()],
      ),
      expect(role('heading', { name: 'Runs', level: 1 })).toExist(),
      expect(selector('.run-detail')).toContainText('Completed'),
      expect(selector('.run-detail')).toContainText(
        'Dependency traversal complete',
      ),
    )
  })

  it('opens Cloudflare settings from the account menu', () => {
    scene(
      { update, view },
      given(ready),
      click(role('button', { name: 'Account menu' })),
      click(role('menuitem', { name: 'Settings' })),
      expect(role('dialog')).toContainText('Cloudflare Workers AI'),
      expect(role('button', { name: 'Test connection' })).toExist(),
    )
  })

  it('requires acknowledging the USG consent notice on entry', () => {
    scene(
      { update, view },
      given(
        modifyFields(initialModel, {
          storage: () => 'Ready',
          executionMode: () => 'Simulation',
        }),
      ),
      expect(role('dialog')).toContainText(
        'U.S. Government Information System',
      ),
      click(role('button', { name: 'OK' })),
      expect(role('dialog')).not.toExist(),
    )
  })
})
