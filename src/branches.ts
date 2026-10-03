import { Option } from 'effect'
import { modifyFields } from 'foldkit/struct'

import type { Branch, Requirement, Workspace } from './domain'
import type { Model } from './main'

export const workingRequirements = (model: Model): ReadonlyArray<Requirement> =>
  Option.match(model.maybeActiveBranch, {
    onNone: () => model.workspace.requirements,
    onSome: id =>
      model.workspace.branches.find(
        branch => branch.id === id && branch.status === 'Draft',
      )?.requirements ?? model.workspace.requirements,
  })

export const writeRequirements = (
  model: Model,
  requirements: ReadonlyArray<Requirement>,
): Workspace =>
  Option.match(model.maybeActiveBranch, {
    onNone: () =>
      modifyFields(model.workspace, { requirements: () => requirements }),
    onSome: id =>
      modifyFields(model.workspace, {
        branches: branches =>
          branches.map(branch =>
            branch.id === id && branch.status === 'Draft'
              ? modifyFields(branch, {
                  requirements: () => requirements,
                  reviewStatus: () => 'Pending',
                })
              : branch,
          ),
      }),
  })

const sameContent = (left: Requirement, right: Requirement): boolean =>
  left.title === right.title &&
  left.description === right.description &&
  left.kind === right.kind &&
  left.owner === right.owner &&
  left.status === right.status &&
  left.links.length === right.links.length &&
  left.links.every(id => right.links.includes(id))

export const branchChanges = (branch: Branch): ReadonlyArray<Requirement> =>
  branch.requirements.filter(item => {
    const base = branch.base.find(candidate => candidate.id === item.id)
    return !base || !sameContent(item, base)
  })

export const branchConflicts = (
  branch: Branch,
  current: ReadonlyArray<Requirement>,
): ReadonlyArray<Requirement> =>
  branchChanges(branch).filter(item => {
    const base = branch.base.find(candidate => candidate.id === item.id)
    const baseline = current.find(candidate => candidate.id === item.id)
    return baseline
      ? !sameContent(item, baseline) && (!base || !sameContent(base, baseline))
      : Boolean(base)
  })

export const mergeRequirements = (
  branch: Branch,
  current: ReadonlyArray<Requirement>,
): ReadonlyArray<Requirement> => {
  const changes = branchChanges(branch)
  return current
    .map(item => {
      const changed = changes.find(candidate => candidate.id === item.id)
      return changed
        ? modifyFields(changed, {
            revision: () => Math.max(item.revision, changed.revision) + 1,
          })
        : item
    })
    .concat(
      changes.filter(
        item => !current.some(candidate => candidate.id === item.id),
      ),
    )
}
