import { Array, type Order } from 'effect'

import type { GroupBy, Requirement, SortKey } from './domain'
import type { Model } from './main'

const statusRank: Readonly<Record<Requirement['status'], number>> = {
  Draft: 0,
  'Needs review': 1,
  Verified: 2,
}

const sortValue: Readonly<
  Record<SortKey, (item: Requirement) => string | number>
> = {
  Artifact: item => item.id,
  Type: item => item.kind,
  Status: item => statusRank[item.status],
  Owner: item => item.owner,
  Links: item => item.links.length,
  Revision: item => item.revision,
}

const compare = (left: string | number, right: string | number): -1 | 0 | 1 =>
  left < right ? -1 : left > right ? 1 : 0

export const visibleArtifacts = (
  model: Model,
  requirements: ReadonlyArray<Requirement>,
): ReadonlyArray<Requirement> => {
  const query = model.search.toLowerCase()
  const items = requirements.filter(
    item =>
      `${item.id} ${item.title} ${item.owner} ${item.description}`
        .toLowerCase()
        .includes(query) &&
      (model.filter === 'All artifacts' ||
        item.kind === model.filter ||
        item.status === model.filter),
  )
  if (model.maybeSortKey._tag === 'None') {
    return items
  }
  const value = sortValue[model.maybeSortKey.value]
  const order: Order.Order<Requirement> = (left, right) =>
    model.sortDirection === 'Ascending'
      ? compare(value(left), value(right))
      : compare(value(right), value(left))
  return Array.sort(items, order)
}

export type ArtifactGroup = Readonly<{
  key: string
  label: string
  items: ReadonlyArray<Requirement>
}>

const groupLabel: Readonly<
  Record<Exclude<GroupBy, 'None'>, (item: Requirement) => string>
> = {
  Status: item => item.status,
  Owner: item => item.owner,
  Type: item => item.kind,
}

export const groupArtifacts = (
  items: ReadonlyArray<Requirement>,
  groupBy: GroupBy,
): ReadonlyArray<ArtifactGroup> => {
  if (groupBy === 'None') {
    return [{ key: 'all', label: 'All artifacts', items }]
  }
  const label = groupLabel[groupBy]
  const labels = Array.dedupe(items.map(label))
  return labels.map(value => ({
    key: `${groupBy}:${value}`,
    label: value,
    items: items.filter(item => label(item) === value),
  }))
}
