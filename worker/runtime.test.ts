import { Schema } from 'effect'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
// @vitest-environment node
import { execFile } from 'node:child_process'
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { Run } from '../src/domain'
import { fixtureRun, fixtureToken, runId } from './test-fixtures'

const mockAI = `
let calls = [];
export default {
  async fetch(request) {
    if (new URL(request.url).pathname === '/calls') return Response.json(calls);
    const call = await request.json();
    calls.push(call);
    if (call.gateway?.id !== 'stream') return Response.json({ error: 'Missing AI Gateway' }, { status: 400 });
    const tool = call.input.messages.find(message => message.role === 'tool');
    const artifact = tool ? JSON.parse(tool.content) : undefined;
    const delta = artifact ? { content: 'Read-only finding for ' + artifact.title + '. Human review required.' } : {
      tool_calls: [{ index: 0, id: 'artifact-read', type: 'function', function: { name: 'get_artifact', arguments: '{"id":"REQ-002"}' } }]
    };
    const events = [
      { choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] },
      { choices: [{ index: 0, delta, finish_reason: null }] },
      { choices: [{ index: 0, delta: {}, finish_reason: artifact ? 'stop' : 'tool_calls' }], usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 } }
    ];
    return new Response(events.map(event => 'data: ' + JSON.stringify(event) + '\\n\\n').join('') + 'data: [DONE]\\n\\n', { headers: { 'Content-Type': 'text/event-stream' } });
  }
};`
const wrapper = `
const testWrapper = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/__test__/advance') {
      await env.FLEETS.getByName(url.searchParams.get('id')).advance();
      return new Response('Advanced');
    }
    if (url.pathname === '/__test__/schedules') return Response.json(await env.FLEETS.getByName(url.searchParams.get('id')).listSchedules());
    if (url.pathname === '/__test__/calls') return env.MOCK_AI.fetch('http://mock/calls');
    return originalFetch(request, env, ctx);
  }
};`
const aiBinding = `
export default { fetch() { return new Response('Stream test assets'); } };`

const exec = promisify(execFile)
let mf: Miniflare
let directory: string
let bundle: string
let bundleModules: Array<{ type: 'ESModule'; path: string }>
const createRuntime = () =>
  new Miniflare(
    convertV4MiniflareOptions({
      isolatedResourcePersistencePath: directory,
      resourcePersistencePath: directory,
      workers: [
        {
          name: 'stream',
          compatibilityDate: '2026-10-03',
          compatibilityFlags: ['nodejs_compat'],
          modulesRoot: bundle,
          modules: bundleModules,
          bindings: {
            STREAM_ACCESS_TOKEN: fixtureToken,
            AI_GATEWAY_ID: 'stream',
            AI_MODEL: '@cf/zai-org/glm-5.3',
          },
          durableObjects: {
            FLEETS: {
              className: 'Fleet',
              useSQLite: true,
              unsafeUniqueKey: 'stream-local-pi-test',
            },
          },
          serviceBindings: { MOCK_AI: 'mock-ai', ASSETS: 'test-assets' },
        },
        {
          name: 'test-assets',
          compatibilityDate: '2026-10-03',
          modules: true,
          script: aiBinding,
        },
        {
          name: 'mock-ai',
          compatibilityDate: '2026-10-03',
          modules: true,
          script: mockAI,
        },
      ],
    }),
  )
const api = (path: string, body?: unknown) =>
  mf.dispatchFetch(`http://stream.test${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: `Basic ${btoa(`stream:${fixtureToken}`)}`,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
const snapshot = async (): Promise<Run> => {
  const response = await api(`/api/runs/${runId}`)
  const body: unknown = await response.json()
  if (!response.ok) {
    throw new Error(`Snapshot HTTP ${response.status}: ${JSON.stringify(body)}`)
  }
  return Schema.decodeUnknownSync(Run)(body)
}
const advance = async () => {
  const response = await api(`/__test__/advance?id=${runId}`)
  expect(response.status).toBe(200)
  return snapshot()
}

beforeAll(async () => {
  await exec('bun', ['run', 'build'])
  directory = await mkdtemp(join(tmpdir(), 'stream-pi-test-'))
  bundle = join(directory, 'bundle')
  await cp(
    new URL('../.cloudflare/output/v0/workers/default/bundle', import.meta.url),
    bundle,
    { recursive: true },
  )
  let implementation = await readFile(join(bundle, 'index.js'), 'utf8')
  const defaultExport = /(\w+) as default/.exec(implementation)?.[1]
  if (!defaultExport) {
    throw new Error('Worker bundle has no default export')
  }
  implementation += `\nconst originalFetch = ${defaultExport}.fetch;\n${wrapper}\n${defaultExport}.fetch = testWrapper.fetch;`
  implementation = implementation.replace(
    'binding: this.env.AI,',
    `binding: {
    run: (model, input, options) => this.env.MOCK_AI.fetch('http://mock/inference', {
      method: 'POST', body: JSON.stringify({ model, input, gateway: options.gateway }), signal: options.signal
    })
  },`,
  )
  await writeFile(join(bundle, 'index.js'), implementation)
  const chunks = (await readdir(join(bundle, 'assets'))).filter(file =>
    file.endsWith('.js'),
  )
  bundleModules = ['index.js', ...chunks.map(file => join('assets', file))].map(
    file => ({ type: 'ESModule', path: join(bundle, file) }),
  )
  mf = createRuntime()
}, 30_000)
afterAll(async () => {
  if (mf) {
    await mf.dispose()
  }
  if (directory) {
    await rm(directory, { recursive: true, force: true })
  }
})

describe('real Pi Harness in local workerd with SQLite and fake inference', () => {
  it('executes read-only tools with fake inference, holds the next wave, and recovers after restart', async () => {
    const response = await api(`/api/runs/${runId}`, fixtureRun())
    expect(response.status).toBe(202)
    await advance()
    await api(`/api/runs/${runId}/control`, 'Hold')
    await expect
      .poll(async () => (await advance()).tasks[0]?.status, { timeout: 10_000 })
      .toBe('Completed')
    const run = await snapshot()
    expect(run.status).toBe('Paused')
    expect(run.tasks[0]?.output).toContain('Read-only finding for')
    expect(run.tasks[0]?.session._tag).toBe('Pi')
    expect(run.tasks[2]?.status).toBe('Queued')
    const calls = await api('/__test__/calls')
    const data: unknown = await calls.json()
    const decoded = Schema.decodeUnknownSync(
      Schema.Array(
        Schema.Struct({
          model: Schema.String,
          gateway: Schema.Struct({ id: Schema.String }),
          input: Schema.Record(Schema.String, Schema.Unknown),
        }),
      ),
    )(data)
    expect(decoded).toHaveLength(4)
    expect(
      decoded.every(
        call =>
          call.gateway.id === 'stream' &&
          call.model === '@cf/zai-org/glm-5.3' &&
          call.input['max_tokens'] === 2048,
      ),
    ).toBe(true)
    const earlier = await snapshot()
    await mf.dispose()
    mf = createRuntime()
    const recovered = await snapshot()
    expect(recovered.tasks).toEqual(earlier.tasks)
    await api(`/api/runs/${runId}/control`, 'Resume')
    await api(`/api/runs/${runId}/control`, 'Resume')
    const schedules = await api(`/__test__/schedules?id=${runId}`)
    const scheduledData: unknown = await schedules.json()
    expect(
      Schema.decodeUnknownSync(Schema.Array(Schema.Unknown))(scheduledData),
    ).toHaveLength(1)
    await expect
      .poll(async () => (await advance()).status, { timeout: 10_000 })
      .toBe('Completed')
    const complete = await snapshot()
    expect(complete.tasks.every(task => task.status === 'Completed')).toBe(true)
    const after = await api(`/__test__/schedules?id=${runId}`)
    expect(await after.text()).toBe('[]')
    expect(complete.requirements).toEqual(fixtureRun().requirements)
  }, 15_000)
})
