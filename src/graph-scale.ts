import { Array, Order } from 'effect'

import type { Requirement } from './domain'

export type ArtifactKind = Requirement['kind']

export interface GraphIndex {
  readonly byId: ReadonlyMap<string, Requirement>
  readonly parents: ReadonlyMap<string, ReadonlyArray<string>>
  readonly children: ReadonlyMap<string, ReadonlyArray<string>>
}

export interface Placed {
  readonly item: Requirement
  readonly x: number
  readonly y: number
}

export interface Cluster {
  readonly key: string
  readonly title: string
  readonly maybeSystemId: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly members: ReadonlyArray<Placed>
}

export interface MatrixRow {
  readonly item: Requirement
  readonly cells: ReadonlyArray<ReadonlyArray<Requirement>>
  readonly hasGap: boolean
}

export const cardLimit = 150
export const overviewZoom = 0.6
export const matrixColumns: ReadonlyArray<ArtifactKind> = [
  'Function',
  'Design',
  'Interface',
  'Test',
  'Risk',
]
export const matrixRowLimit = 300

const append = (
  map: Map<string, Array<string>>,
  key: string,
  value: string,
): void => {
  const list = map.get(key)
  if (list) {
    list.push(value)
  } else {
    map.set(key, [value])
  }
}

export const graphIndex = (items: ReadonlyArray<Requirement>): GraphIndex => {
  const byId = new Map(items.map(item => [item.id, item] as const))
  const parents = new Map<string, Array<string>>()
  const children = new Map<string, Array<string>>()
  items.forEach(item =>
    Array.dedupe(item.links)
      .filter(id => byId.has(id) && id !== item.id)
      .forEach(id => {
        append(parents, id, item.id)
        append(children, item.id, id)
      }),
  )
  return { byId, parents, children }
}

const reach = (
  edges: ReadonlyMap<string, ReadonlyArray<string>>,
  start: string,
  hops: number,
): ReadonlySet<string> => {
  const seen = new Set<string>([start])
  const visit = (frontier: ReadonlyArray<string>, remaining: number): void => {
    if (remaining <= 0 || Array.isReadonlyArrayEmpty(frontier)) {
      return
    }
    const fresh = Array.dedupe(
      frontier.flatMap(id => edges.get(id) ?? []).filter(id => !seen.has(id)),
    )
    fresh.forEach(id => seen.add(id))
    visit(fresh, remaining - 1)
  }
  visit([start], hops)
  return seen
}

export const traceSet = (
  index: GraphIndex,
  id: string,
  hops: number,
): ReadonlySet<string> =>
  new Set([
    ...reach(index.parents, id, hops),
    ...reach(index.children, id, hops),
  ])

export const focusItems = (
  items: ReadonlyArray<Requirement>,
  selected: string,
  hiddenKinds: ReadonlyArray<ArtifactKind>,
): ReadonlyArray<Requirement> =>
  items.filter(item => item.id === selected || !hiddenKinds.includes(item.kind))

export const hiddenNeighbours = (
  index: GraphIndex,
  id: string,
  visible: ReadonlySet<string>,
): number =>
  Array.dedupe([
    ...(index.parents.get(id) ?? []),
    ...(index.children.get(id) ?? []),
  ]).filter(other => !visible.has(other)).length

export const cardLayout = (
  items: ReadonlyArray<Requirement>,
  index: GraphIndex,
  lastColumn: number,
): ReadonlyArray<Placed> => {
  const present = new Set(items.map(item => item.id))
  const parentsOf = (id: string): ReadonlyArray<string> =>
    (index.parents.get(id) ?? []).filter(parent => present.has(parent))
  const depths = new Map<string, number>()
  const visiting = new Set<string>()
  const depth = (id: string): number => {
    const known = depths.get(id)
    if (known !== undefined) {
      return known
    }
    if (visiting.has(id)) {
      return 0
    }
    visiting.add(id)
    const parents = parentsOf(id)
    const value = Array.isReadonlyArrayEmpty(parents)
      ? 0
      : Math.min(lastColumn, Math.max(...parents.map(depth)) + 1)
    visiting.delete(id)
    depths.set(id, value)
    return value
  }
  const columns = items.map(item => ({ item, column: depth(item.id) }))
  const rows = new Map<string, number>()
  const deepest = Math.max(0, ...columns.map(entry => entry.column))
  const weight = (item: Requirement): number => {
    const placed = parentsOf(item.id).flatMap(parent => {
      const row = rows.get(parent)
      return row === undefined ? [] : [row]
    })
    return Array.isArrayEmpty(placed)
      ? Number.MAX_SAFE_INTEGER
      : placed.reduce((sum, row) => sum + row, 0) / placed.length
  }
  return Array.range(0, deepest).flatMap(column => {
    const entries = columns.filter(entry => entry.column === column)
    const ordered =
      column === 0
        ? entries
        : Array.sortWith(entries, entry => weight(entry.item), Order.Number)
    return ordered.map((entry, row) => {
      rows.set(entry.item.id, row)
      return { item: entry.item, x: 28 + column * 242, y: 36 + row * 134 }
    })
  })
}

export const clusterKeys = (
  items: ReadonlyArray<Requirement>,
  index: GraphIndex,
): ReadonlyMap<string, string> => {
  const keys = new Map<string, string>()
  const visiting = new Set<string>()
  const keyOf = (id: string): string => {
    const known = keys.get(id)
    if (known !== undefined) {
      return known
    }
    if (visiting.has(id)) {
      return ''
    }
    visiting.add(id)
    const value =
      index.byId.get(id)?.kind === 'System'
        ? id
        : ((index.parents.get(id) ?? []).map(keyOf).find(key => key !== '') ??
          '')
    visiting.delete(id)
    keys.set(id, value)
    return value
  }
  items.forEach(item => keyOf(item.id))
  return keys
}

const clusterWidth = 224
const clusterGap = 16
const dot = 14
const dotsPerRow = Math.floor((clusterWidth - 16) / dot)

export const overviewLayout = (
  items: ReadonlyArray<Requirement>,
  index: GraphIndex,
  width: number,
): { readonly clusters: ReadonlyArray<Cluster>; readonly height: number } => {
  const keys = clusterKeys(items, index)
  const groups = Array.groupBy(items, item => keys.get(item.id) ?? '')
  const ordered = Array.sortWith(
    Object.keys(groups),
    key => (key === '' ? 1 : 0),
    Order.Number,
  )
  const laneCount = Math.max(
    1,
    Math.floor((width - 28) / (clusterWidth + clusterGap)),
  )
  const lanes = Array.makeBy(laneCount, () => 36)
  const clusters = ordered.map(key => {
    const members = groups[key] ?? []
    const lane = lanes.indexOf(Math.min(...lanes))
    const x = 28 + lane * (clusterWidth + clusterGap)
    const y = lanes[lane] ?? 36
    const height = 44 + Math.ceil(members.length / dotsPerRow) * dot + 8
    lanes[lane] = y + height + clusterGap
    const system = index.byId.get(key)
    return {
      key: key === '' ? 'unassigned' : key,
      title: system ? system.title : 'No parent system',
      maybeSystemId: system ? system.id : '',
      x,
      y,
      width: clusterWidth,
      height,
      members: members.map((item, position) => ({
        item,
        x: x + 8 + (position % dotsPerRow) * dot,
        y: y + 44 + Math.floor(position / dotsPerRow) * dot,
      })),
    }
  })
  return { clusters, height: Math.max(...lanes) + 12 }
}

export const matrixRows = (
  items: ReadonlyArray<Requirement>,
  index: GraphIndex,
): ReadonlyArray<MatrixRow> =>
  items
    .filter(item => item.kind === 'Requirement' || item.kind === 'System')
    .map(item => {
      const linked = Array.dedupe([
        ...(index.children.get(item.id) ?? []),
        ...(index.parents.get(item.id) ?? []),
      ]).flatMap(id => {
        const other = index.byId.get(id)
        return other ? [other] : []
      })
      const cells = matrixColumns.map(kind =>
        linked.filter(other => other.kind === kind),
      )
      return {
        item,
        cells,
        hasGap:
          item.kind === 'Requirement' &&
          Array.isReadonlyArrayEmpty(
            cells[matrixColumns.indexOf('Test')] ?? [],
          ),
      }
    })

const stressKinds: ReadonlyArray<ArtifactKind> = [
  'Requirement',
  'Requirement',
  'Requirement',
  'Requirement',
  'Function',
  'Function',
  'Design',
  'Design',
  'Design',
  'Test',
  'Test',
  'Test',
  'Interface',
  'Interface',
  'Risk',
]

const stressKind = (position: number, systems: number): ArtifactKind =>
  position < systems
    ? 'System'
    : (stressKinds[Math.floor(position / systems) % stressKinds.length] ??
      'Requirement')

const stressId = (position: number, systems: number): string => {
  const kind = stressKind(position, systems)
  return kind === 'System'
    ? `SYS-S${position}`
    : `${kind.slice(0, 3).toUpperCase()}-S${position % systems}-${position}`
}

export const stressRequirements = (
  count: number,
  systems = 8,
): ReadonlyArray<Requirement> =>
  Array.makeBy(count, position => {
    const kind = stressKind(position, systems)
    return {
      id: stressId(position, systems),
      title:
        kind === 'System' ? `Subsystem ${position}` : `${kind} ${position}`,
      description: '',
      kind,
      status:
        position % 7 === 0
          ? 'Draft'
          : position % 5 === 0
            ? 'Needs review'
            : 'Verified',
      owner: 'Stress test',
      links: [position + systems, position + systems * 2]
        .concat(position % 10 === 3 ? [position + systems + 1] : [])
        .filter(target => target < count)
        .map(target => stressId(target, systems)),
      revision: 1,
    }
  })
