import { Effect } from 'effect'
import { modifyFields } from 'foldkit/struct'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { seedWorkspace } from './domain'
import {
  LoadWorkspace,
  SaveWorkspace,
  initialModel,
  legacyStorageKey,
  storageKey,
  update,
} from './main'
import { Message } from './message'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('workspace persistence', () => {
  it.each(['{malformed json', JSON.stringify({ version: 999 })])(
    'rejects invalid imports without replacing local data: %s',
    jsonText => {
      const ready = modifyFields(initialModel, { storage: () => 'Ready' })
      const importer = update(
        update(ready, Message.ClickedImport()).model,
        Message.UpdatedImportJson({ jsonText }),
      ).model
      const result = update(importer, Message.SubmittedImport())
      expect(result.model.workspace).toBe(ready.workspace)
      expect(result.model.modal._tag).toBe('WorkspaceImporter')
    },
  )
  it('imports a valid workspace and pauses unfinished runs', () => {
    const ready = modifyFields(initialModel, {
      storage: () => 'Ready',
      executionMode: () => 'Simulation',
    })
    const running = update(
      update(ready, Message.ClickedLaunch()).model,
      Message.SubmittedRun(),
    ).model
    const importer = update(
      update(ready, Message.ClickedImport()).model,
      Message.UpdatedImportJson({
        jsonText: JSON.stringify(running.workspace),
      }),
    ).model
    const result = update(importer, Message.SubmittedImport())
    expect(result.model.workspace.runs).toHaveLength(1)
    expect(result.model.workspace.runs[0]?.status).toBe('Paused')
    expect(result.model.workspace.runs[0]?.token).toBe(1)
    expect(result.model.modal._tag).toBe('Closed')
    expect(result.model.workspace.events[0]).toContain('imported from JSON')
  })
  it('bounds imports before parsing oversized JSON', () => {
    const ready = modifyFields(initialModel, { storage: () => 'Ready' })
    const importer = update(
      update(ready, Message.ClickedImport()).model,
      Message.UpdatedImportJson({ jsonText: ' '.repeat(2_000_001) }),
    ).model
    expect(update(importer, Message.SubmittedImport()).model.workspace).toBe(
      ready.workspace,
    )
  })
  it('preserves saved work from before the Stream rename', async () => {
    localStorage.setItem(legacyStorageKey, JSON.stringify(seedWorkspace))
    expect(await Effect.runPromise(LoadWorkspace().effect)).toEqual(
      Message.CompletedLoadWorkspace({
        workspace: seedWorkspace,
        restored: true,
      }),
    )
  })
  it('restores workspaces created before branching was added', async () => {
    const { branches: _branches, ...legacy } = seedWorkspace
    localStorage.setItem(storageKey, JSON.stringify(legacy))
    const loaded = await Effect.runPromise(LoadWorkspace().effect)
    expect(loaded._tag).toBe('CompletedLoadWorkspace')
    if (loaded._tag !== 'CompletedLoadWorkspace') {
      throw new Error('Workspace did not load')
    }
    expect(loaded.workspace.branches).toEqual([])
  })
  it('loads sample data when no saved workspace exists', async () => {
    expect(await Effect.runPromise(LoadWorkspace().effect)).toEqual(
      Message.CompletedLoadWorkspace({
        workspace: seedWorkspace,
        restored: false,
      }),
    )
  })

  it('round-trips a saved workspace through schema validation', async () => {
    expect(
      await Effect.runPromise(
        SaveWorkspace({ workspace: seedWorkspace }).effect,
      ),
    ).toEqual(Message.CompletedSaveWorkspace())
    expect(await Effect.runPromise(LoadWorkspace().effect)).toEqual(
      Message.CompletedLoadWorkspace({
        workspace: seedWorkspace,
        restored: true,
      }),
    )
  })

  it('pauses unfinished runs on reload rather than restarting timers', async () => {
    const ready = modifyFields(initialModel, {
      storage: () => 'Ready',
      executionMode: () => 'Simulation',
    })
    const running = update(
      update(ready, Message.ClickedLaunch()).model,
      Message.SubmittedRun(),
    ).model
    await Effect.runPromise(
      SaveWorkspace({ workspace: running.workspace }).effect,
    )
    const result = await Effect.runPromise(LoadWorkspace().effect)
    expect(result._tag).toBe('CompletedLoadWorkspace')
    if (result._tag !== 'CompletedLoadWorkspace') {
      throw new Error('Workspace did not load')
    }
    expect(result.workspace.runs[0]?.status).toBe('Paused')
    expect(result.workspace.runs[0]?.token).toBe(1)
    expect(update(initialModel, result).model.storage).toBe('Ready')
  })

  it('fails safely on malformed JSON and invalid saved schemas', async () => {
    localStorage.setItem(storageKey, '{not json')
    expect((await Effect.runPromise(LoadWorkspace().effect))._tag).toBe(
      'FailedLoadWorkspace',
    )
    localStorage.setItem(storageKey, JSON.stringify({ version: 999 }))
    expect((await Effect.runPromise(LoadWorkspace().effect))._tag).toBe(
      'FailedLoadWorkspace',
    )
  })

  it('keeps edits in memory and surfaces a storage quota failure', async () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded')
    })
    const result = await Effect.runPromise(
      SaveWorkspace({ workspace: seedWorkspace }).effect,
    )
    expect(result._tag).toBe('FailedSaveWorkspace')
    expect(update(initialModel, result).model.storage).toBe('Unavailable')
    expect(update(initialModel, result).model.workspace).toEqual(seedWorkspace)
  })
})
