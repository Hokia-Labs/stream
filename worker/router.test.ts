// @vitest-environment node
import { Schema } from 'effect'
import { modifyFields } from 'foldkit/struct'
import { describe, expect, it, vi } from 'vitest'

import { Run, TaskSession } from '../src/domain'
import { maxRequestBytes } from '../src/executor'
import {
  type FleetHandle,
  type ReportStore,
  type WorkerServices,
  authorized,
  handleRequest,
} from './router'
import { fixtureRun, fixtureToken, runId } from './test-fixtures'

const setup = () => {
  const fleet = {
    start: vi.fn<FleetHandle['start']>(run => Promise.resolve(run)),
    snapshot: vi.fn<FleetHandle['snapshot']>().mockResolvedValue(undefined),
    control: vi.fn<FleetHandle['control']>().mockResolvedValue(undefined),
  }
  const fleetLookup = vi.fn<WorkerServices['fleet']>(() => fleet)
  const store = {
    loadReports: vi
      .fn<ReportStore['loadReports']>()
      .mockResolvedValue([
        { name: 'HAS.md', content: '# HAS', isEdited: true },
      ]),
    saveReports: vi
      .fn<ReportStore['saveReports']>()
      .mockImplementation(files => Promise.resolve(files.length)),
  }
  const services: WorkerServices = {
    accessToken: fixtureToken,
    publicOrigin: undefined,
    gateway: 'stream',
    model: '@cf/zai-org/glm-5.3',
    fleet: fleetLookup,
    reports: () => store,
    assets: vi.fn<WorkerServices['assets']>(() =>
      Promise.resolve(new Response('Stream')),
    ),
  }
  return { fleet, services, fleetLookup, store }
}
const request = (path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers)
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Basic ${btoa(`stream:${fixtureToken}`)}`)
  }
  headers.set('Content-Type', 'application/json')
  return new Request(`https://stream.example${path}`, { ...init, headers })
}
const route = `/api/runs/${runId}`

describe('Worker API boundary', () => {
  it('stores twin reports durably', async () => {
    const { services, store } = setup()
    const loaded = await handleRequest(request('/api/reports'), services)
    expect(await loaded.json()).toEqual({
      files: [{ name: 'HAS.md', content: '# HAS', isEdited: true }],
    })
    const files = [
      { name: 'HCI-PSU-001-RevB.md', content: '# HCI', isEdited: false },
    ]
    const saved = await handleRequest(
      request('/api/reports', { method: 'PUT', body: JSON.stringify(files) }),
      services,
    )
    expect(await saved.json()).toEqual({ saved: 1 })
    expect(store.saveReports).toHaveBeenCalledWith(files)
    const invalid = await handleRequest(
      request('/api/reports', {
        method: 'PUT',
        body: JSON.stringify([{ name: '../x', content: '', isEdited: false }]),
      }),
      services,
    )
    expect(invalid.status).toBe(400)
    const crossOrigin = await handleRequest(
      request('/api/reports', {
        method: 'PUT',
        body: JSON.stringify(files),
        headers: { Origin: 'https://evil.example' },
      }),
      services,
    )
    expect(crossOrigin.status).toBe(403)
  })

  it('reports configuration without exposing credentials or invoking Pi', async () => {
    const { services, fleet } = setup()
    const locked = await handleRequest(
      new Request('https://stream.example/api/executor'),
      services,
    )
    expect(await locked.text()).toContain('Locked')
    const ready = await handleRequest(request('/api/executor'), services)
    expect(await ready.text()).toContain('Ready')
    const unconfigured = await handleRequest(request('/api/executor'), {
      ...services,
      accessToken: undefined,
    })
    const body = await unconfigured.text()
    expect(body).toContain('Unconfigured')
    expect(body).not.toContain(fixtureToken)
    expect(fleet.start).not.toHaveBeenCalled()
  })

  it('challenges unauthorized access and rejects malformed Basic credentials', async () => {
    const { services, fleet } = setup()
    await Promise.all(
      [
        '',
        'Bearer token',
        'Basic !!!',
        `Basic ${btoa('stream:wrong')}`,
        `Basic ${btoa(`other:${fixtureToken}`)}`,
      ].map(async credentials => {
        const response = await handleRequest(
          request(route, { headers: { Authorization: credentials } }),
          services,
        )
        expect(response.status).toBe(401)
        expect(response.headers.get('WWW-Authenticate')).toContain('Basic')
      }),
    )
    expect(fleet.snapshot).not.toHaveBeenCalled()
    expect(await authorized(request(route), fixtureToken)).toBe(true)
  })

  it('redirects browser-native unlock without returning the access token', async () => {
    const { services } = setup()
    const response = await handleRequest(request('/api/unlock'), services)
    expect(response.status).toBe(303)
    expect(response.headers.get('Location')).toBe('/')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('rejects cross-origin mutation before accessing a durable fleet', async () => {
    const { services, fleet, fleetLookup } = setup()
    const response = await handleRequest(
      request(route, {
        method: 'POST',
        headers: { Origin: 'https://attacker.example' },
        body: JSON.stringify(fixtureRun()),
      }),
      services,
    )
    expect(response.status).toBe(403)
    expect(fleet.start).not.toHaveBeenCalled()
    expect(fleetLookup).not.toHaveBeenCalled()
  })

  it('accepts the same origin and explicitly configured development origin', async () => {
    const { services, fleet } = setup()
    await Promise.all(
      ['https://stream.example', 'http://localhost:5173'].map(async origin => {
        const response = await handleRequest(
          request(route, {
            method: 'POST',
            headers: { Origin: origin },
            body: JSON.stringify(fixtureRun()),
          }),
          { ...services, publicOrigin: 'http://localhost:5173' },
        )
        expect(response.status).toBe(202)
      }),
    )
    expect(fleet.start).toHaveBeenCalledTimes(2)
  })

  it('rebuilds queued tasks and binds execution to the route rather than trusting client status', async () => {
    const { services } = setup()
    const input = modifyFields(fixtureRun(), {
      tasks: tasks =>
        tasks.map(task =>
          modifyFields(task, {
            status: () => 'Completed',
            session: () => TaskSession.Pi({ id: 'forged-session' }),
            output: () => 'forged output',
          }),
        ),
    })
    const response = await handleRequest(
      request(route, { method: 'POST', body: JSON.stringify(input) }),
      services,
    )
    const data: unknown = await response.json()
    const run = Schema.decodeUnknownSync(Run)(data)
    expect(
      run.tasks.every(
        task =>
          task.status === 'Queued' &&
          task.session._tag === 'Pending' &&
          !task.output,
      ),
    ).toBe(true)
    expect(run.execution).toEqual({ _tag: 'Cloudflare', runId })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('rejects malformed JSON, duplicate identities, invalid sources, excessive agents, and excessive context', async () => {
    const { services, fleet } = setup()
    const run = fixtureRun()
    const invalid = [
      '{',
      JSON.stringify(modifyFields(run, { targetId: () => 'missing' })),
      JSON.stringify(
        modifyFields(run, { agents: agents => agents.concat(agents) }),
      ),
      JSON.stringify(
        modifyFields(run, {
          agents: agents =>
            agents.flatMap((agent, index) =>
              [0, 1, 2].map(copy =>
                modifyFields(agent, { id: () => `agent-${index}-${copy}` }),
              ),
            ),
        }),
      ),
      JSON.stringify(
        modifyFields(run, {
          requirements: requirements => requirements.concat(requirements),
        }),
      ),
      JSON.stringify(modifyFields(run, { title: () => '' })),
      JSON.stringify(
        modifyFields(run, {
          requirements: requirements =>
            requirements.map(item => ({
              ...item,
              description: 'x'.repeat(60_001),
            })),
        }),
      ),
    ]
    await Promise.all(
      invalid.map(async body => {
        const response = await handleRequest(
          request(route, { method: 'POST', body }),
          services,
        )
        expect(response.status).toBe(400)
      }),
    )
    expect(fleet.start).not.toHaveBeenCalled()
  })

  it('caps streamed request bodies even without Content-Length', async () => {
    const { services, fleet } = setup()
    const response = await handleRequest(
      request(route, { method: 'POST', body: 'x'.repeat(maxRequestBytes + 1) }),
      services,
    )
    expect(response.status).toBe(400)
    expect(fleet.start).not.toHaveBeenCalled()
  })

  it('preserves pre-dispatch controls and returns pending rather than inventing a run', async () => {
    const { services, fleet } = setup()
    const response = await handleRequest(
      request(`${route}/control`, {
        method: 'POST',
        body: JSON.stringify('Cancel'),
      }),
      services,
    )
    expect(response.status).toBe(202)
    expect(await response.text()).toContain('pending')
    expect(fleet.control).toHaveBeenCalledWith('Cancel')
    const missing = await handleRequest(request(route), services)
    expect(missing.status).toBe(404)
  })

  it('returns bounded error messages without leaking provider failures', async () => {
    const { services, fleet } = setup()
    fleet.start.mockRejectedValue(new Error('private-provider-token'))
    const response = await handleRequest(
      request(route, { method: 'POST', body: JSON.stringify(fixtureRun()) }),
      services,
    )
    expect(response.status).toBe(409)
    expect(await response.text()).not.toContain('private-provider-token')
  })
})
