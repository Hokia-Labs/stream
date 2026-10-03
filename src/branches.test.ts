import { Array, Option, Schema } from 'effect'
import { Command, given, message, model, steps, story } from 'foldkit/story'
import { modifyFields } from 'foldkit/struct'
import { describe, expect, it } from 'vitest'

import { branchChanges, branchConflicts, workingRequirements } from './branches'
import { Branch, seedWorkspace } from './domain'
import { SaveWorkspace, initialModel, update } from './main'
import { Message } from './message'

const ready = modifyFields(initialModel, {
  storage: () => 'Ready',
  executionMode: () => 'Simulation',
})
const saved = () =>
  Command.resolve(SaveWorkspace, Message.CompletedSaveWorkspace())
const created = () =>
  steps(
    message(Message.ClickedNewBranch()),
    message(Message.UpdatedTitle({ value: 'Battery redesign' })),
    message(Message.SubmittedBranch()),
    saved(),
  )
const edited = (id: string, title: string) =>
  steps(
    message(Message.ClickedEditRequirement({ id })),
    message(Message.UpdatedTitle({ value: title })),
    message(Message.SubmittedRequirement()),
    saved(),
  )

describe('branch change control', () => {
  it('restores older branches with a pending review rather than silently approving them', () => {
    const branch = Schema.decodeUnknownSync(Branch)({
      id: 'BR-legacy',
      title: 'Legacy proposal',
      status: 'Draft',
      base: seedWorkspace.requirements,
      requirements: seedWorkspace.requirements,
    })
    expect(branch.reviewStatus).toBe('Pending')
  })
  it('requires a human review and invalidates approval after further edits', () => {
    story(
      update,
      given(ready),
      created(),
      edited('REQ-002', 'Proposed power budget'),
      message(Message.ClickedMergeBranch({ id: 'BR-012' })),
      model(current => {
        expect(current.workspace.branches[0]?.status).toBe('Draft')
        expect(current.workspace.requirements).toEqual(
          seedWorkspace.requirements,
        )
      }),
      message(
        Message.DecidedBranchReview({ id: 'BR-012', reviewStatus: 'Rejected' }),
      ),
      saved(),
      message(Message.ClickedMergeBranch({ id: 'BR-012' })),
      model(current => {
        expect(current.workspace.branches[0]?.reviewStatus).toBe('Rejected')
        expect(current.workspace.branches[0]?.status).toBe('Draft')
      }),
      message(
        Message.DecidedBranchReview({ id: 'BR-012', reviewStatus: 'Approved' }),
      ),
      saved(),
      edited('REQ-002', 'Revised after approval'),
      message(Message.ClickedMergeBranch({ id: 'BR-012' })),
      model(current => {
        expect(current.workspace.branches[0]?.reviewStatus).toBe('Pending')
        expect(current.workspace.branches[0]?.status).toBe('Draft')
      }),
      message(
        Message.DecidedBranchReview({ id: 'BR-012', reviewStatus: 'Approved' }),
      ),
      saved(),
      message(Message.ClickedMergeBranch({ id: 'BR-012' })),
      saved(),
      model(current => {
        expect(current.workspace.branches[0]?.status).toBe('Merged')
        expect(
          current.workspace.requirements.find(item => item.id === 'REQ-002')
            ?.title,
        ).toBe('Revised after approval')
      }),
    )
  })
  it('isolates artifact edits until an explicit merge', () => {
    story(
      update,
      given(ready),
      created(),
      edited('REQ-002', 'Revised power budget'),
      model(current => {
        expect(current.workspace.requirements).toEqual(
          seedWorkspace.requirements,
        )
        expect(
          workingRequirements(current).find(item => item.id === 'REQ-002')
            ?.title,
        ).toBe('Revised power budget')
        expect(
          current.workspace.branches[0] &&
            branchChanges(current.workspace.branches[0]),
        ).toHaveLength(1)
      }),
      message(
        Message.DecidedBranchReview({ id: 'BR-012', reviewStatus: 'Approved' }),
      ),
      saved(),
      message(Message.ClickedMergeBranch({ id: 'BR-012' })),
      saved(),
      model(current => {
        expect(
          current.workspace.requirements.find(item => item.id === 'REQ-002')
            ?.title,
        ).toBe('Revised power budget')
        expect(current.workspace.branches[0]?.status).toBe('Merged')
        expect(Option.isNone(current.maybeActiveBranch)).toBe(true)
        expect(current.workspace.events[0]).toContain('merged into Base')
      }),
    )
  })

  it('blocks a conflicting merge instead of overwriting newer baseline edits', () => {
    story(
      update,
      given(ready),
      created(),
      edited('REQ-002', 'Branch power budget'),
      message(Message.SelectedBranch({ id: '' })),
      edited('REQ-002', 'Baseline power budget'),
      message(Message.ClickedMergeBranch({ id: 'BR-012' })),
      model(current => {
        expect(
          current.workspace.requirements.find(item => item.id === 'REQ-002')
            ?.title,
        ).toBe('Baseline power budget')
        expect(current.workspace.branches[0]?.status).toBe('Draft')
        expect(
          current.workspace.branches[0] &&
            branchConflicts(
              current.workspace.branches[0],
              current.workspace.requirements,
            ),
        ).toHaveLength(1)
        expect(Option.getOrElse(current.maybeToast, () => '')).toContain(
          'Merge blocked',
        )
      }),
    )
  })

  it('preserves unrelated baseline edits when merging a branch', () => {
    story(
      update,
      given(ready),
      created(),
      edited('REQ-002', 'Branch power budget'),
      message(Message.SelectedBranch({ id: '' })),
      edited('REQ-003', 'Updated navigation'),
      message(
        Message.DecidedBranchReview({ id: 'BR-012', reviewStatus: 'Approved' }),
      ),
      saved(),
      message(Message.ClickedMergeBranch({ id: 'BR-012' })),
      saved(),
      model(current => {
        expect(
          current.workspace.requirements.find(item => item.id === 'REQ-002')
            ?.title,
        ).toBe('Branch power budget')
        expect(
          current.workspace.requirements.find(item => item.id === 'REQ-003')
            ?.title,
        ).toBe('Updated navigation')
      }),
    )
  })

  it('refuses empty merges and nonexistent branches', () => {
    story(
      update,
      given(ready),
      created(),
      message(Message.ClickedMergeBranch({ id: 'BR-012' })),
      model(current => {
        expect(current.workspace.branches[0]?.status).toBe('Draft')
        expect(Option.getOrElse(current.maybeToast, () => '')).toContain(
          'No changes',
        )
      }),
      message(Message.SelectedBranch({ id: 'missing' })),
      model(current =>
        expect(Option.getOrElse(current.maybeActiveBranch, () => '')).toBe(
          'BR-012',
        ),
      ),
    )
  })

  it('runs against a branch snapshot without changing Base', () => {
    const branchCreated = update(
      update(
        update(ready, Message.ClickedNewBranch()).model,
        Message.UpdatedTitle({ value: 'Battery redesign' }),
      ).model,
      Message.SubmittedBranch(),
    ).model
    const branchEdited = update(
      update(
        update(branchCreated, Message.ClickedEditRequirement({ id: 'REQ-002' }))
          .model,
        Message.UpdatedTitle({ value: 'Branch power budget' }),
      ).model,
      Message.SubmittedRequirement(),
    ).model
    const launched = update(
      update(branchEdited, Message.ClickedLaunch()).model,
      Message.SubmittedRun(),
    ).model
    expect(
      launched.workspace.runs[0]?.requirements.find(
        item => item.id === 'REQ-002',
      )?.title,
    ).toBe('Branch power budget')
    expect(launched.workspace.requirements).toEqual(seedWorkspace.requirements)
  })

  it('detects link changes but ignores link ordering and revision-only changes', () => {
    const original = seedWorkspace.requirements[0]
    expect(original).toBeDefined()
    if (!original) {
      return
    }
    const branch: Branch = {
      id: 'test',
      title: 'test',
      status: 'Draft',
      reviewStatus: 'Pending',
      base: [original],
      requirements: [
        modifyFields(original, {
          links: links => Array.reverse(links),
          revision: () => 100,
        }),
      ],
    }
    expect(branchChanges(branch)).toHaveLength(0)
    expect(
      branchChanges(
        modifyFields(branch, {
          requirements: requirements =>
            requirements.map(item => modifyFields(item, { links: () => [] })),
        }),
      ),
    ).toHaveLength(1)
  })
})
