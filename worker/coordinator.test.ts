import { modifyFields } from 'foldkit/struct'
import { describe, expect, it, vi } from 'vitest'

import { TaskSession } from '../src/domain'
import { maxRunMillis } from '../src/executor'
import {
  FleetCoordinator,
  type FleetState,
  type PiDriver,
  operationId,
} from './coordinator'
import { fixtureRun } from './test-fixtures'

const setup = () => {
  let state: FleetState = { kind: 'Empty', intent: 'Running' }
  let session = 0
  const storage = {
    read: () => state,
    write: (next: FleetState) => {
      state = next
    },
  }
  const pi = {
    createSession: vi.fn<PiDriver['createSession']>(() =>
      Promise.resolve(`pi-${++session}`),
    ),
    submit: vi.fn<PiDriver['submit']>().mockResolvedValue(undefined),
    poll: vi.fn<PiDriver['poll']>().mockResolvedValue({
      kind: 'Completed',
      text: 'Evidence requires human review.',
    }),
    abort: vi.fn<PiDriver['abort']>().mockResolvedValue(undefined),
  }
  const now = vi.fn<() => number>(() => 0)
  const coordinator = new FleetCoordinator(storage, pi, now)
  return { coordinator, storage, pi, now }
}

describe('durable fleet coordination', () => {
  it('runs agents in parallel within each wave and passes earlier findings into the next wave', async () => {
    const { coordinator, pi } = setup()
    const run = coordinator.initialize(fixtureRun())
    await coordinator.advance()
    expect(pi.submit).toHaveBeenCalledTimes(2)
    expect(coordinator.snapshot()?.tasks.map(task => task.status)).toEqual([
      'Running',
      'Running',
      'Queued',
    ])
    const first = run.tasks[0]
    expect(first && pi.submit.mock.calls[0]?.[1]).toBe(
      first && operationId(run, first),
    )
    await coordinator.advance()
    expect(pi.submit).toHaveBeenCalledTimes(3)
    expect(pi.submit.mock.calls[2]?.[2]).toContain(
      'Evidence requires human review.',
    )
    await coordinator.advance()
    expect(coordinator.snapshot()?.status).toBe('Completed')
    expect(coordinator.snapshot()?.requirements).toEqual(run.requirements)
    await coordinator.advance()
    expect(pi.submit).toHaveBeenCalledTimes(3)
  })

  it('does not advance a wave while any agent is still running', async () => {
    const { coordinator, pi } = setup()
    coordinator.initialize(fixtureRun())
    await coordinator.advance()
    pi.poll.mockResolvedValueOnce({ kind: 'Running', text: 'Partial findings' })
    await coordinator.advance()
    expect(pi.submit).toHaveBeenCalledTimes(2)
    expect(coordinator.snapshot()?.tasks[0]?.output).toBe('Partial findings')
  })

  it('holds the next stage while allowing active model calls to finish', async () => {
    const { coordinator, pi } = setup()
    coordinator.initialize(fixtureRun())
    await coordinator.advance()
    coordinator.control('Hold')
    await coordinator.advance()
    expect(coordinator.snapshot()?.status).toBe('Paused')
    expect(coordinator.snapshot()?.tasks.map(task => task.status)).toEqual([
      'Completed',
      'Completed',
      'Queued',
    ])
    expect(pi.submit).toHaveBeenCalledTimes(2)
    coordinator.control('Resume')
    await coordinator.advance()
    expect(pi.submit).toHaveBeenCalledTimes(3)
  })

  it('persists cancellation before dispatch and cannot undo it with resume', async () => {
    const { coordinator, pi } = setup()
    coordinator.control('Cancel')
    coordinator.control('Resume')
    expect(coordinator.initialize(fixtureRun()).status).toBe('Cancelling')
    await coordinator.advance()
    expect(coordinator.snapshot()?.status).toBe('Cancelled')
    expect(pi.submit).not.toHaveBeenCalled()
  })

  it('retries abort failures instead of falsely reporting cancellation', async () => {
    const { coordinator, pi } = setup()
    coordinator.initialize(fixtureRun())
    await coordinator.advance()
    coordinator.control('Cancel')
    pi.abort.mockRejectedValueOnce(new Error('Temporary transport failure'))
    await coordinator.advance()
    expect(coordinator.snapshot()?.status).toBe('Cancelling')
    await coordinator.advance()
    expect(coordinator.snapshot()?.status).toBe('Cancelled')
    expect(
      coordinator.snapshot()?.tasks.every(task => task.status === 'Cancelled'),
    ).toBe(true)
    expect(pi.abort).toHaveBeenCalledTimes(4)
    expect(pi.submit).toHaveBeenCalledTimes(2)
  })

  it('retains the failed terminal intent across an abort failure and a new coordinator', async () => {
    const { coordinator, storage, pi, now } = setup()
    coordinator.initialize(fixtureRun())
    await coordinator.advance()
    pi.poll.mockRejectedValueOnce(new Error('Provider failed'))
    pi.abort.mockRejectedValueOnce(new Error('Abort unavailable'))
    await coordinator.advance()
    const recovered = new FleetCoordinator(storage, pi, now)
    await recovered.advance()
    expect(recovered.snapshot()?.status).toBe('Failed')
    expect(recovered.snapshot()?.tasks[0]?.status).toBe('Failed')
    expect(recovered.snapshot()?.tasks[2]?.status).toBe('Cancelled')
    expect(pi.submit).toHaveBeenCalledTimes(2)
  })

  it('enforces the run deadline without dispatching a replacement', async () => {
    const { coordinator, pi, now } = setup()
    coordinator.initialize(fixtureRun())
    await coordinator.advance()
    now.mockReturnValue(maxRunMillis)
    await coordinator.advance()
    expect(coordinator.snapshot()?.status).toBe('Failed')
    expect(pi.abort).toHaveBeenCalledTimes(2)
    expect(pi.submit).toHaveBeenCalledTimes(2)
  })

  it('reconnects using durable session IDs without submitting duplicate operations', async () => {
    const { coordinator, storage, pi, now } = setup()
    coordinator.initialize(fixtureRun())
    await coordinator.advance()
    const recovered = new FleetCoordinator(storage, pi, now)
    recovered.control('Hold')
    await recovered.advance()
    expect(pi.poll.mock.calls.map(call => call[0])).toEqual(['pi-1', 'pi-2'])
    expect(pi.createSession).toHaveBeenCalledTimes(2)
    expect(pi.submit).toHaveBeenCalledTimes(2)
  })

  it('reuses a persisted session and operation ID when recovering a partially submitted task', async () => {
    const { coordinator, storage, pi, now } = setup()
    coordinator.initialize(fixtureRun())
    const state = storage.read()
    if (state.kind !== 'Ready') {
      throw new Error('Missing test run')
    }
    storage.write({
      ...state,
      run: modifyFields(state.run, {
        tasks: tasks =>
          tasks.map((task, index) =>
            index === 0
              ? modifyFields(task, {
                  session: () => TaskSession.Pi({ id: 'persisted-session' }),
                })
              : task,
          ),
      }),
    })
    const recovered = new FleetCoordinator(storage, pi, now)
    await recovered.advance()
    expect(pi.createSession).toHaveBeenCalledTimes(1)
    expect(pi.submit.mock.calls[0]?.[0]).toBe('persisted-session')
    expect(pi.submit.mock.calls[0]?.[1]).toBe(
      `RUN-test/${fixtureRun().agents[0]?.id}`,
    )
  })

  it('treats repeated launches as idempotent but rejects a changed immutable snapshot', async () => {
    const { coordinator, pi } = setup()
    const run = fixtureRun()
    coordinator.initialize(run)
    await coordinator.advance()
    expect(coordinator.initialize(run)).toEqual(coordinator.snapshot())
    expect(pi.createSession).toHaveBeenCalledTimes(2)
    expect(() =>
      coordinator.initialize(
        modifyFields(run, { title: () => 'Different review' }),
      ),
    ).toThrow('another snapshot')
  })

  it('stops later waves after submission failure', async () => {
    const { coordinator, pi } = setup()
    coordinator.initialize(fixtureRun())
    pi.submit.mockRejectedValueOnce(new Error('Submit failed'))
    await coordinator.advance()
    await coordinator.advance()
    expect(coordinator.snapshot()?.status).toBe('Failed')
    expect(pi.submit).toHaveBeenCalledTimes(2)
    expect(coordinator.snapshot()?.tasks[2]?.status).toBe('Cancelled')
  })
})
