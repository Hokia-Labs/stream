import { Option } from 'effect'
import { Command, given, message, model, steps, story } from 'foldkit/story'
import { modifyFields } from 'foldkit/struct'
import { describe, expect, it } from 'vitest'

import { Execution, type Run, downstream, seedWorkspace } from './domain'
import {
  SaveWorkspace,
  WaitForSimulationWave,
  initialModel,
  update,
} from './main'
import { Message } from './message'

const ready = modifyFields(initialModel, {
  storage: () => 'Ready',
  executionMode: () => 'Simulation',
})
const running = update(
  update(ready, Message.ClickedLaunch()).model,
  Message.SubmittedRun(),
).model
const saved = () =>
  Command.resolve(SaveWorkspace, Message.CompletedSaveWorkspace())
const launched = () =>
  steps(
    message(Message.ClickedLaunch()),
    message(Message.SubmittedRun()),
    saved(),
  )
const wave = (token: number, id = 'RUN-012') =>
  steps(
    Command.resolve(
      WaitForSimulationWave,
      Message.CompletedSimulationWave({ id, token }),
    ),
    saved(),
  )

const cloudflareReady = modifyFields(initialModel, {
  storage: () => 'Ready',
  maybeExecutorStatus: () =>
    Option.some({ state: 'Ready', model: 'test-model', gateway: 'stream' }),
})
const preparingCloudflare = update(
  update(cloudflareReady, Message.ClickedLaunch()).model,
  Message.SubmittedRun(),
).model
const durableId = '8c360bf8-c0d5-47d2-a273-4d86610d46dc'
const liveCloudflare = update(
  preparingCloudflare,
  Message.CompletedPrepareCloudflareRun({
    id: 'RUN-012',
    token: 0,
    runId: durableId,
  }),
).model
const remoteCloudflare = (): Run => {
  const run = liveCloudflare.workspace.runs[0]
  if (!run) {
    throw new Error('Cloudflare fixture did not launch')
  }
  return modifyFields(run, {
    status: () => 'Completed',
    tasks: tasks =>
      tasks.map(task =>
        modifyFields(task, {
          status: () => 'Completed',
          output: () => 'Evidence requires human review.',
        }),
      ),
  })
}

describe('Cloudflare lifecycle', () => {
  it('blocks an unconfigured executor rather than launching simulation', () => {
    const blockedLaunch = update(
      update(
        modifyFields(cloudflareReady, {
          maybeExecutorStatus: () => Option.none(),
        }),
        Message.ClickedLaunch(),
      ).model,
      Message.SubmittedRun(),
    )
    expect(blockedLaunch.model.workspace.runs).toEqual([])
    expect(blockedLaunch.model.executionMode).toBe('Cloudflare')
  })

  it('prepares live runs without fabricated task progress', () => {
    expect(preparingCloudflare.workspace.runs[0]?.execution).toEqual(
      Execution.Preparing(),
    )
    expect(
      preparingCloudflare.workspace.runs[0]?.tasks.every(
        task => task.status === 'Queued' && task.output === '',
      ),
    ).toBe(true)
    expect(liveCloudflare.workspace.runs[0]?.execution).toEqual(
      Execution.Cloudflare({ runId: durableId }),
    )
  })

  it('fails preparation without dispatching or fabricating a review', () => {
    story(
      update,
      given(preparingCloudflare),
      message(Message.FailedPrepareCloudflareRun({ id: 'RUN-012', token: 0 })),
      saved(),
      model(current => {
        expect(current.workspace.runs[0]?.status).toBe('Failed')
        expect(current.workspace.runs[0]?.execution._tag).toBe('Preparing')
        expect(current.workspace.approvals).toEqual(seedWorkspace.approvals)
      }),
    )
  })

  it('ignores late preparation after cancellation', () => {
    const cancelled = update(
      preparingCloudflare,
      Message.ClickedCancelRun({
        id: 'RUN-012',
      }),
    ).model
    const late = update(
      cancelled,
      Message.CompletedPrepareCloudflareRun({
        id: 'RUN-012',
        token: 0,
        runId: durableId,
      }),
    )
    expect(late.model).toBe(cancelled)
    expect(late.commands).toBeUndefined()
    expect(cancelled.workspace.runs[0]?.status).toBe('Cancelled')
  })

  it('pauses on a connection failure while keeping the durable identity', () => {
    const failed = update(
      liveCloudflare,
      Message.FailedSyncCloudflareRun({
        id: 'RUN-012',
        token: 0,
        error: 'Reconnect to retrieve durable progress.',
      }),
    ).model
    expect(failed.workspace.runs[0]?.status).toBe('Paused')
    expect(failed.workspace.runs[0]?.execution).toEqual(
      Execution.Cloudflare({ runId: durableId }),
    )
    expect(failed.workspace.approvals).toEqual(seedWorkspace.approvals)
    const reconnected = update(
      failed,
      Message.ClickedReconnectRun({
        id: 'RUN-012',
      }),
    ).model
    const stale = update(
      reconnected,
      Message.CompletedSyncCloudflareRun({
        id: 'RUN-012',
        token: 0,
        run: remoteCloudflare(),
      }),
    )
    expect(stale.model).toBe(reconnected)
  })

  it('rejects a result belonging to a different durable run', () => {
    const result = update(
      liveCloudflare,
      Message.CompletedSyncCloudflareRun({
        id: 'RUN-012',
        token: 0,
        run: modifyFields(remoteCloudflare(), {
          execution: () => Execution.Cloudflare({ runId: 'another-run' }),
        }),
      }),
    )
    expect(result.model).toBe(liveCloudflare)
  })

  it('creates human review once without modifying artifacts', () => {
    const remote = remoteCloudflare()
    const synchronized = update(
      liveCloudflare,
      Message.CompletedSyncCloudflareRun({
        id: 'RUN-012',
        token: 0,
        run: remote,
      }),
    ).model
    const repeated = update(
      synchronized,
      Message.CompletedSyncCloudflareRun({
        id: 'RUN-012',
        token: 1,
        run: remote,
      }),
    ).model
    expect(
      repeated.workspace.approvals.filter(item => item.runId === 'RUN-012'),
    ).toHaveLength(1)
    expect(repeated.workspace.approvals.at(-1)?.status).toBe('Pending')
    expect(repeated.workspace.requirements).toEqual(seedWorkspace.requirements)
  })

  it('keeps cancellation pending through disconnect until the server confirms it', () => {
    const cancelling = update(
      liveCloudflare,
      Message.ClickedCancelRun({
        id: 'RUN-012',
      }),
    ).model
    expect(cancelling.workspace.runs[0]?.status).toBe('Cancelling')
    const disconnected = update(
      cancelling,
      Message.FailedSyncCloudflareRun({
        id: 'RUN-012',
        token: 1,
        error: 'Disconnected',
      }),
    ).model
    expect(disconnected.workspace.runs[0]?.status).toBe('Cancelling')
    const remote = modifyFields(remoteCloudflare(), {
      status: () => 'Cancelled',
    })
    const confirmed = update(
      disconnected,
      Message.CompletedSyncCloudflareRun({
        id: 'RUN-012',
        token: 2,
        run: remote,
      }),
    ).model
    expect(confirmed.workspace.runs[0]?.status).toBe('Cancelled')
    expect(confirmed.workspace.approvals).toEqual(seedWorkspace.approvals)
  })
})

describe('artifact and agent state', () => {
  it('validates required fields without changing the workspace', () => {
    story(
      update,
      given(ready),
      message(Message.ClickedNewRequirement()),
      message(Message.SubmittedRequirement()),
      model(current => {
        expect(current.workspace).toEqual(seedWorkspace)
        expect(current.modal._tag).toBe('RequirementEditor')
        expect(Option.getOrElse(current.maybeToast, () => '')).toContain(
          'title, description, and owner',
        )
      }),
    )
  })

  it('creates a linked artifact and persists its revision', () => {
    story(
      update,
      given(ready),
      message(Message.ClickedNewRequirement()),
      message(Message.UpdatedTitle({ value: '  Payload interface  ' })),
      message(
        Message.UpdatedDescription({
          value: 'Connect the payload to the bus.',
        }),
      ),
      message(Message.ToggledLink({ id: 'INT-001' })),
      message(Message.SubmittedRequirement()),
      saved(),
      model(current => {
        expect(current.workspace.requirements.at(-1)).toMatchObject({
          id: 'ART-012',
          title: 'Payload interface',
          revision: 1,
          status: 'Needs review',
          links: ['INT-001'],
        })
        expect(current.modal._tag).toBe('Closed')
        expect(current.workspace.events[0]).toContain('ART-012 revision 1')
      }),
    )
  })

  it('edits an artifact without allowing a self-link', () => {
    story(
      update,
      given(ready),
      message(Message.ClickedEditRequirement({ id: 'REQ-002' })),
      message(Message.ToggledLink({ id: 'REQ-002' })),
      message(Message.UpdatedTitle({ value: 'Updated endurance constraint' })),
      message(Message.SubmittedRequirement()),
      saved(),
      model(current => {
        expect(
          current.workspace.requirements.find(item => item.id === 'REQ-002'),
        ).toMatchObject({
          title: 'Updated endurance constraint',
          revision: 3,
          status: 'Needs review',
          links: ['DES-001', 'TST-001'],
        })
        expect(current.workspace.requirements).toHaveLength(9)
      }),
    )
  })

  it('saves custom agent instructions but does not execute them', () => {
    story(
      update,
      given(ready),
      message(Message.ClickedNewAgent()),
      message(Message.UpdatedTitle({ value: 'Interface reviewer' })),
      message(
        Message.UpdatedInstructions({ value: 'Check interface consistency.' }),
      ),
      message(Message.SubmittedAgent()),
      saved(),
      model(current => {
        expect(current.workspace.agents.at(-1)).toMatchObject({
          name: 'Interface reviewer',
          instructions: 'Check interface consistency.',
          enabled: true,
          wave: 2,
        })
        expect(current.workspace.runs).toEqual([])
      }),
    )
  })
})

describe('staged orchestration', () => {
  it('respects user-configured execution stages', () => {
    story(
      update,
      given(ready),
      message(Message.ClickedEditAgent({ id: 'docs' })),
      message(Message.SelectedAgentWave({ wave: 0 })),
      message(Message.SubmittedAgent()),
      saved(),
      launched(),
      model(current => {
        expect(
          current.workspace.runs[0]?.tasks.find(task => task.agentId === 'docs')
            ?.status,
        ).toBe('Running')
      }),
      wave(0, 'RUN-013'),
      wave(1, 'RUN-013'),
      wave(2, 'RUN-013'),
      model(current => {
        expect(current.workspace.runs[0]?.status).toBe('Completed')
      }),
    )
  })

  it('executes six agents in three waves and opens human review', () => {
    story(
      update,
      given(ready),
      launched(),
      model(current => {
        expect(
          current.workspace.runs[0]?.tasks.map(task => task.status),
        ).toEqual([
          'Running',
          'Running',
          'Queued',
          'Queued',
          'Queued',
          'Queued',
        ])
      }),
      wave(0),
      model(current => {
        expect(current.workspace.runs[0]?.wave).toBe(1)
      }),
      wave(1),
      wave(2),
      model(current => {
        expect(current.workspace.runs[0]?.status).toBe('Completed')
        expect(
          current.workspace.runs[0]?.tasks.every(
            task => task.status === 'Completed' && task.output !== '',
          ),
        ).toBe(true)
        expect(current.workspace.approvals.at(-1)).toMatchObject({
          runId: 'RUN-012',
          status: 'Pending',
        })
        expect(current.workspace.requirements).toEqual(
          seedWorkspace.requirements,
        )
      }),
    )
  })

  it('ignores stale wave completions while paused and resumes with a new token', () => {
    story(
      update,
      given(running),
      message(Message.ClickedPauseRun({ id: 'RUN-012' })),
      saved(),
      message(Message.CompletedSimulationWave({ id: 'RUN-012', token: 0 })),
      model(current => {
        expect(current.workspace.runs[0]?.status).toBe('Paused')
        expect(current.workspace.runs[0]?.tasks[0]?.status).toBe('Running')
      }),
      message(Message.ClickedResumeRun({ id: 'RUN-012' })),
      saved(),
      wave(2),
      wave(3),
      wave(4),
      model(current => {
        expect(current.workspace.runs[0]?.status).toBe('Completed')
      }),
    )
  })

  it('cancels work without generating a review or accepting late completions', () => {
    story(
      update,
      given(running),
      message(Message.ClickedCancelRun({ id: 'RUN-012' })),
      saved(),
      message(Message.CompletedSimulationWave({ id: 'RUN-012', token: 0 })),
      model(current => {
        expect(current.workspace.runs[0]?.status).toBe('Cancelled')
        expect(current.workspace.approvals).toHaveLength(2)
      }),
    )
  })

  it('uses the original snapshot after the workspace changes during a run', () => {
    story(
      update,
      given(running),
      message(Message.ClickedEditRequirement({ id: 'REQ-001' })),
      message(Message.UpdatedTitle({ value: 'Changed after launch' })),
      message(Message.SubmittedRequirement()),
      saved(),
      message(Message.CompletedSimulationWave({ id: 'RUN-012', token: 0 })),
      saved(),
      wave(1),
      wave(2),
      model(current => {
        expect(current.workspace.requirements[0]?.title).toBe(
          'Changed after launch',
        )
        expect(current.workspace.runs[0]?.requirements[0]?.title).toBe(
          'Atlas autonomous platform',
        )
        expect(
          current.workspace.runs[0]?.tasks.find(
            task => task.agentId === 'budget',
          )?.output,
        ).toContain('Atlas autonomous platform')
      }),
    )
  })

  it('does not launch a fleet with no enabled agents', () => {
    const disabled = modifyFields(ready, {
      workspace: workspace =>
        modifyFields(workspace, {
          agents: agents =>
            agents.map(agent => modifyFields(agent, { enabled: () => false })),
        }),
    })
    story(
      update,
      given(disabled),
      message(Message.ClickedLaunch()),
      message(Message.SubmittedRun()),
      model(current => {
        expect(current.workspace.runs).toEqual([])
        expect(Option.getOrElse(current.maybeToast, () => '')).toContain(
          'Enable at least one agent',
        )
      }),
    )
  })

  it('records each approval only once and leaves artifacts unchanged', () => {
    story(
      update,
      given(ready),
      message(Message.ClickedApprove({ id: 'APR-001' })),
      saved(),
      message(Message.ClickedReject({ id: 'APR-001' })),
      model(current => {
        expect(current.workspace.approvals[0]?.status).toBe('Approved')
        expect(current.workspace.events).toHaveLength(4)
        expect(current.workspace.requirements).toEqual(
          seedWorkspace.requirements,
        )
      }),
    )
  })
})

describe('dependency traversal', () => {
  it('finds every reachable artifact only once', () => {
    const affected = downstream(seedWorkspace.requirements, 'REQ-001')
    expect(affected).toHaveLength(8)
    expect(new Set(affected).size).toBe(8)
    expect(affected).not.toContain('REQ-001')
  })

  it('terminates when a dependency cycle is present', () => {
    const cyclic = seedWorkspace.requirements.map(item =>
      item.id === 'INT-001'
        ? modifyFields(item, { links: () => ['REQ-001'] })
        : item,
    )
    expect(downstream(cyclic, 'REQ-001')).toHaveLength(8)
  })
})
