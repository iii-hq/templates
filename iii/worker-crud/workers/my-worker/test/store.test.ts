import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { type CollectionIii, createCollection } from '../src/store.js'

// A tiny local record type: the store is generic and knows nothing of the model.
type Item = { id: string; title: string; done: boolean; created_at: string }
const parseItems = (value: unknown): Item[] => (Array.isArray(value) ? (value as Item[]) : [])
const sortItems = (records: readonly Item[]): Item[] => [...records]
function createItem(current: Item[], input: { title: string }, id: string, created_at: string) {
  const record: Item = { id, title: input.title, done: false, created_at }
  return { record, records: [...current, record] }
}
function updateItem(current: Item[], input: { id: string; done: boolean }) {
  const found = current.find((item) => item.id === input.id)
  if (!found) throw new Error(`item ${input.id} not found`)
  const record = { ...found, done: input.done }
  return { record, records: current.map((item) => (item.id === record.id ? record : item)) }
}

type Call = { function_id: string; namespace?: string; payload: unknown; action?: unknown }
type Registered = { id: string; options?: { private?: boolean; description?: string } }

/** A fake engine: state in a Map, every call recorded, and the registered
    functions captured; `observed` says whether the event function has an
    observer, as FunctionRef.isObserved() would. */
function fakeIii(options: { delayMs?: number } = {}) {
  const state = new Map<string, unknown>()
  const calls: Call[] = []
  const functions: Registered[] = []
  const fake = { observed: false }
  const sleep = () => new Promise((resolve) => setTimeout(resolve, options.delayMs ?? 0))
  const iii = {
    async call(request: Call) {
      calls.push(request)
      const { scope, key, value } = (request.payload ?? {}) as { scope?: string; key?: string; value?: unknown }
      if (request.function_id === 'state::get') {
        await sleep()
        return state.get(`${scope}/${key}`) ?? null
      }
      if (request.function_id === 'state::set') {
        await sleep()
        state.set(`${scope}/${key}`, value)
        return { old_value: null, new_value: value }
      }
      return undefined
    },
    registerFunction(id: string, _handler: unknown, options?: Registered['options']) {
      functions.push({ id, options })
      return { id, isObserved: () => fake.observed, unregister() {} }
    },
  }
  return Object.assign(fake, { iii: iii as unknown as CollectionIii, state, calls, functions })
}

function collection(fake: ReturnType<typeof fakeIii>) {
  return createCollection<Item>({ iii: fake.iii, scope: 'my-worker', key: 'items', parse: parseItems, sort: sortItems })
}

const emitted = (fake: ReturnType<typeof fakeIii>) =>
  fake.calls.filter((call) => !call.function_id.startsWith('state::'))

describe('createCollection', () => {
  it('registers the private my-worker::on-change event function', () => {
    const fake = fakeIii()
    collection(fake)
    assert.deepEqual(fake.functions.map((fn) => [fn.id, fn.options?.private]), [['my-worker::on-change', true]])
  })

  it('reads an absent key as an empty list and persists through state::set without a namespace', async () => {
    const fake = fakeIii()
    const items = collection(fake)
    assert.deepEqual(await items.list(), [])
    await items.mutate('created', (current) => createItem(current, { title: 'a' }, 'id-1', '2026-01-01T00:00:00.000Z'))
    assert.deepEqual(fake.state.get('my-worker/items'), [
      { id: 'id-1', title: 'a', done: false, created_at: '2026-01-01T00:00:00.000Z' },
    ])
    for (const call of fake.calls) assert.equal(call.namespace, undefined, call.function_id)
  })

  it('serializes writes so none is lost', async () => {
    const fake = fakeIii({ delayMs: 5 })
    const items = collection(fake)
    await Promise.all(
      ['a', 'b', 'c', 'd', 'e'].map((title, index) =>
        items.mutate('created', (current) => createItem(current, { title }, `id-${index}`, `2026-01-0${index + 1}T00:00:00.000Z`)),
      ),
    )
    assert.equal((await items.list()).length, 5)
  })

  it('keeps the queue going after a failed change', async () => {
    const fake = fakeIii()
    const items = collection(fake)
    await assert.rejects(items.mutate('updated', (current) => updateItem(current, { id: 'missing', done: true })), /not found/)
    await items.mutate('created', (current) => createItem(current, { title: 'ok' }, 'id-ok', 'now'))
    assert.equal((await items.list()).length, 1)
  })

  it('calls my-worker::on-change with { event, record, records } only while it is observed', async () => {
    const fake = fakeIii()
    const items = collection(fake)
    await items.mutate('created', (current) => createItem(current, { title: 'a' }, 'id-1', 'now'))
    assert.deepEqual(emitted(fake), [], 'nothing observes it yet')

    fake.observed = true
    const { record } = await items.mutate('updated', (current) => updateItem(current, { id: 'id-1', done: true }))
    const calls = emitted(fake)
    assert.deepEqual(calls.map((call) => call.function_id), ['my-worker::on-change'])
    assert.deepEqual(calls[0].payload, { event: 'updated', record, records: [record] })
    assert.deepEqual(calls[0].action, { type: 'void' }, 'fire-and-forget: a slow observer never blocks a write')
    assert.equal(calls[0].namespace, undefined)
  })

  it('emits nothing when the change fails', async () => {
    const fake = fakeIii()
    fake.observed = true
    const items = collection(fake)
    await assert.rejects(items.mutate('removed', () => {
      throw new Error('nope')
    }), /nope/)
    assert.deepEqual(emitted(fake), [])
  })
})
