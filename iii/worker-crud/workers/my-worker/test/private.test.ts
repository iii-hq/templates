// Private fields: kept out of every record the public HTTP API returns, while
// engine callers (iii.trigger, the ADE page) still get them. Runs the real
// CRUD functions (registerDomain) on a fake engine and the real web handlers
// wired the way src/index.ts wires them, against its own test model.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { IIIClient } from 'iii-sdk'
import { registerDomain } from '../src/functions.js'
import { checkModel, type Model, privateFields } from '../src/record.js'
import { stripPrivate, webHandlers } from '../src/web.js'

const GUESTS = {
  resource: 'guests',
  title: 'Guests',
  titleField: 'name',
  fields: {
    name: { type: 'string', label: 'Name', required: true },
    email: { type: 'string', label: 'Email', required: true, unique: true, private: true },
    attending: { type: 'boolean', label: 'Attending', default: false },
  },
  listColumns: ['name', 'email', 'attending'],
  sort: [{ field: 'created_at' }],
} as const satisfies Model

describe('stripPrivate', () => {
  const record = { id: 'a', name: 'Ada', email: 'ada@example.com', created_at: 1, updated_at: 1 }
  const { email: _email, ...publicRecord } = record

  it('drops the named fields from record and from each of records', () => {
    assert.deepEqual(stripPrivate({ record }, ['email']), { record: publicRecord })
    assert.deepEqual(stripPrivate({ records: [record, record], counts: { total: 2 } }, ['email']), {
      records: [publicRecord, publicRecord],
      counts: { total: 2 },
    })
  })

  it('leaves everything else as is, and does not change its input', () => {
    const body = { record, nested: { record }, records: [record, 'x', null], model: { fields: { email: { private: true } } } }
    const out = stripPrivate(body, ['email']) as typeof body
    assert.deepEqual(out.nested, { record })
    assert.deepEqual(out.records, [publicRecord, 'x', null])
    assert.deepEqual(out.model, body.model)
    assert.equal(body.record.email, 'ada@example.com')
    for (const value of [null, 'text', 3, [record]]) assert.deepEqual(stripPrivate(value, ['email']), value)
    assert.equal((stripPrivate({ record }, []) as { record: unknown }).record, record)
  })
})

describe('a model with a private field', () => {
  it('passes checkModel and names its private fields', () => {
    assert.equal(checkModel(GUESTS), GUESTS)
    assert.deepEqual(privateFields(GUESTS), ['email'])
  })
})

/** A fake engine: state in a Map, registered functions callable by trigger. */
function fakeEngine() {
  const state = new Map<string, unknown>()
  const functions = new Map<string, (payload: unknown) => Promise<unknown>>()
  const iii = {
    registerFunction(id: string, handler: (payload: unknown) => Promise<unknown>) {
      functions.set(id, handler)
    },
    registerTrigger() {},
    registerTriggerType() {
      return { unregister() {} }
    },
    async trigger({ function_id, payload }: { function_id: string; payload?: unknown }) {
      const { scope, key, value } = (payload ?? {}) as { scope?: string; key?: string; value?: unknown }
      if (function_id === 'state::get') return state.get(`${scope}/${key}`) ?? null
      if (function_id === 'state::set') {
        state.set(`${scope}/${key}`, value)
        return { old_value: null, new_value: value }
      }
      const handler = functions.get(function_id)
      if (!handler) throw new Error(`function ${function_id} not found`)
      return handler(payload)
    },
  }
  return iii
}

describe('the public HTTP API with a private field', () => {
  const engine = fakeEngine()
  registerDomain(engine as unknown as IIIClient, GUESTS)
  // As src/index.ts wires it: the API calls through the engine.
  const web = webHandlers('/nonexistent', (fn, payload) => engine.trigger({ function_id: `my-worker::${fn}`, payload }), GUESTS)
  const api = (fn: string, body: unknown) => web.api({ path_params: { fn }, body })

  it('create and list over HTTP omit the email; an engine call returns it', async () => {
    const created = await api('create', { name: 'Ada', email: 'ada@example.com' })
    assert.equal(created.status_code, 200)
    const record = (created.body as { record: Record<string, unknown> }).record
    assert.equal(record.name, 'Ada')
    assert.equal('email' in record, false)
    assert.doesNotMatch(JSON.stringify(created.body), /ada@example\.com/)

    const listed = await api('list', {})
    const records = (listed.body as { records: Record<string, unknown>[] }).records
    assert.equal(records.length, 1)
    assert.equal('email' in records[0], false)
    assert.doesNotMatch(JSON.stringify(listed.body), /ada@example\.com/)

    // get is not public by default (PUBLIC_CRUD), so it cannot leak either.
    assert.equal((await api('get', { id: record.id })).status_code, 404)
    const viaToggle = await api('toggle', { id: record.id, field: 'attending' })
    assert.equal((viaToggle.body as { record: Record<string, unknown> }).record.attending, true)
    assert.equal('email' in (viaToggle.body as { record: object }).record, false)

    // Engine callers (iii.trigger, the ADE page through host.iii) see every field.
    const full = (await engine.trigger({ function_id: 'my-worker::guests::list', payload: {} })) as { records: Record<string, unknown>[] }
    assert.equal(full.records[0].email, 'ada@example.com')
  })

  it('a unique clash on the private field does not echo the value', async () => {
    const res = await api('create', { name: 'Eve', email: ' ADA@example.com ' })
    assert.equal(res.status_code, 500)
    assert.deepEqual(res.body, { error: 'Email is already used' })
    assert.doesNotMatch(JSON.stringify(res.body), /ada@example\.com/i)
  })

  it('my-worker::model over HTTP still reports the option', async () => {
    const res = await api('model', {})
    const model = (res.body as { model: Model }).model
    assert.equal(model.fields.email.private, true)
  })
})
