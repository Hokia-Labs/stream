import { Array, Order } from 'effect'

import {
  type Agent,
  type Approval,
  type Requirement,
  type Run,
  type Task,
  type Workspace,
  downstream,
  stageNames,
} from './domain'
import {
  type Level,
  levelOf,
  markdownBlocks,
  summarizeFinding,
} from './markdown'

export { type Level, levelOf }

export interface LogLine {
  readonly id: string
  readonly source: string
  readonly text: string
  readonly level: Level
}

export interface Annotation {
  readonly id: string
  readonly level: Level
  readonly title: string
  readonly detail: string
  readonly anchor: string
  readonly agentId: string
}

export interface RunSummary {
  readonly done: number
  readonly total: number
  readonly failed: number
  readonly findings: number
  readonly pendingFindings: number
  readonly stage: string
}

export interface ImpactCounts {
  readonly hasSnapshot: boolean
  readonly added: number
  readonly changed: number
  readonly removed: number
  readonly downstream: number
  readonly tests: number
  readonly brokenLinks: number
}

export interface LaunchEstimate {
  readonly agents: number
  readonly stages: number
  readonly artifacts: number
  readonly contextTokens: number
  readonly minimumInputTokens: number
}

export const taskAnchor = (run: Run, agentId: string): string =>
  `task-${run.id}-${agentId}`

const agentName = (run: Run, agentId: string): string =>
  run.agents.find(agent => agent.id === agentId)?.name ?? agentId

export const agentWave = (run: Run, task: Task): number =>
  run.agents.find(agent => agent.id === task.agentId)?.wave ?? 0

const taskLevel = (task: Task): Level =>
  task.status === 'Failed'
    ? 'error'
    : task.status === 'Cancelled'
      ? 'warn'
      : 'info'

export const runLog = (
  workspace: Workspace,
  run: Run,
): ReadonlyArray<LogLine> => {
  const events = Array.reverse(
    workspace.events.filter(event => event.includes(run.id)),
  ).map((text, index) => ({
    id: `event-${index}`,
    source: 'Workspace',
    text,
    level: levelOf(text),
  }))
  const tasks = run.tasks.flatMap(task => {
    const source = agentName(run, task.agentId)
    return [
      {
        id: `${task.agentId}-status`,
        source,
        text: `${task.status}${task.session._tag === 'Pi' ? ` · Pi session ${task.session.id}` : ''}`,
        level: taskLevel(task),
      },
      ...markdownBlocks(task.output).map((text, index) => ({
        id: `${task.agentId}-${index}`,
        source,
        text,
        level: levelOf(text),
      })),
    ]
  })
  return [...events, ...tasks]
}

export const runSummary = (workspace: Workspace, run: Run): RunSummary => {
  const findings = workspace.approvals.filter(
    approval => approval.runId === run.id,
  )
  const active = run.tasks.filter(
    task => task.status === 'Running' || task.status === 'Queued',
  )
  const wave = Array.isArrayEmpty(active)
    ? undefined
    : Math.min(...active.map(task => agentWave(run, task)))
  return {
    done: run.tasks.filter(task => task.status === 'Completed').length,
    total: run.tasks.length,
    failed: run.tasks.filter(task => task.status === 'Failed').length,
    findings: findings.length,
    pendingFindings: findings.filter(approval => approval.status === 'Pending')
      .length,
    stage:
      wave === undefined
        ? 'All stages settled'
        : `${String(wave + 1).padStart(2, '0')} · ${stageNames[wave] ?? 'Stage'}`,
  }
}

export const findingText = (
  workspace: Workspace,
  runId: string,
  agentId: string,
): string => {
  const output =
    workspace.runs
      .find(run => run.id === runId)
      ?.tasks.find(task => task.agentId === agentId)?.output ?? ''
  return output.trim()
    ? output
    : (workspace.approvals.find(
        approval => approval.runId === runId && approval.agentId === agentId,
      )?.detail ?? '')
}

const severityRank = { Error: 0, Warning: 1, Info: 2, Pass: 3 } as const

export const findingTasks = (run: Run): ReadonlyArray<Task> =>
  Array.sort(
    run.tasks.filter(task => task.output.trim().length > 0),
    Order.mapInput(
      Order.Number,
      (task: Task) =>
        severityRank[summarizeFinding(task.output, task.status).severity] *
          1000 +
        agentWave(run, task),
    ),
  )

export const runAnnotations = (
  workspace: Workspace,
  run: Run,
): ReadonlyArray<Annotation> => {
  const taskNotes = run.tasks.flatMap((task): ReadonlyArray<Annotation> => {
    const name = agentName(run, task.agentId)
    const anchor = taskAnchor(run, task.agentId)
    const summary = summarizeFinding(task.output, task.status)
    if (task.status === 'Failed' || task.status === 'Cancelled') {
      return [
        {
          id: `${task.agentId}-status`,
          level: taskLevel(task),
          title: `${name} · ${task.status.toLowerCase()}`,
          detail: summary.title || 'No output was recorded.',
          anchor,
          agentId: task.agentId,
        },
      ]
    }
    return task.output.trim() &&
      (summary.severity === 'Error' || summary.severity === 'Warning')
      ? [
          {
            id: `${task.agentId}-warning`,
            level: summary.severity === 'Error' ? 'error' : 'warn',
            title: name,
            detail: summary.title,
            anchor,
            agentId: task.agentId,
          },
        ]
      : []
  })
  const findingNotes = workspace.approvals
    .filter(approval => approval.runId === run.id)
    .map(approval => {
      const headline = summarizeFinding(
        findingText(workspace, run.id, approval.agentId),
      ).title
      return {
        id: approval.id,
        level: 'info' as const,
        title: `Finding · ${approval.title}`,
        detail: headline
          ? `${approval.status} · ${headline}`
          : `${approval.targetId} · ${approval.status}`,
        anchor: taskAnchor(run, approval.agentId),
        agentId: approval.agentId,
      }
    })
  const rank: Readonly<Record<Level, number>> = { error: 0, warn: 1, info: 2 }
  return Array.sort(
    [...taskNotes, ...findingNotes],
    Order.mapInput(Order.Number, (note: Annotation) => rank[note.level]),
  )
}

const sameRequirement = (left: Requirement, right: Requirement): boolean =>
  left.title === right.title &&
  left.status === right.status &&
  left.owner === right.owner &&
  left.revision === right.revision &&
  left.description === right.description &&
  left.links.join(',') === right.links.join(',')

export const impactCounts = (
  workspace: Workspace,
  approval: Approval,
): ImpactCounts => {
  const snapshot = workspace.runs.find(
    run => run.id === approval.runId,
  )?.requirements
  const current = workspace.requirements
  const affected = downstream(current, approval.targetId)
  const affectedIds = new Set(affected)
  const scope = new Set([approval.targetId, ...affected])
  const ids = new Set(current.map(item => item.id))
  return {
    hasSnapshot: snapshot !== undefined,
    added: snapshot
      ? current.filter(item => !snapshot.some(old => old.id === item.id)).length
      : 0,
    removed: snapshot ? snapshot.filter(old => !ids.has(old.id)).length : 0,
    changed: snapshot
      ? current.filter(item => {
          const old = snapshot.find(candidate => candidate.id === item.id)
          return old !== undefined && !sameRequirement(old, item)
        }).length
      : 0,
    downstream: affected.length,
    tests: current.filter(
      item => affectedIds.has(item.id) && item.kind === 'Test',
    ).length,
    brokenLinks: current
      .filter(item => scope.has(item.id))
      .flatMap(item => item.links)
      .filter(link => !ids.has(link)).length,
  }
}

export const launchScopeRequirements = (
  requirements: ReadonlyArray<Requirement>,
  targetId: string,
  scope: 'Workspace' | 'Impact',
): ReadonlyArray<Requirement> => {
  if (scope === 'Workspace') {
    return requirements
  }
  const included = new Set([targetId, ...downstream(requirements, targetId)])
  return requirements.filter(item => included.has(item.id))
}

export const launchEstimate = (
  requirements: ReadonlyArray<Requirement>,
  agents: ReadonlyArray<Agent>,
): LaunchEstimate => {
  const enabled = agents.filter(agent => agent.enabled)
  const contextTokens = Math.ceil(JSON.stringify(requirements).length / 4)
  return {
    agents: enabled.length,
    stages: Array.dedupe(enabled.map(agent => agent.wave)).length,
    artifacts: requirements.length,
    contextTokens,
    minimumInputTokens: contextTokens * enabled.length,
  }
}
