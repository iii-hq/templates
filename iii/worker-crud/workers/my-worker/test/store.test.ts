import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { type ChangeConfig, type CollectionIii, createCollection } from '../src/store.js'

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

type Call = { function_id: string; namespace?: string; payload: unknown; metadata?: unknown }
type Handlers = {
  registerTrigger: (binding: unknown) => Promise<void>
  unregisterTrigger: (binding: unknown) => Promise<void>
}

/** A fake engine: state in a Map, every trigger call recorded, and the
    trigger type's handlers captured so a test can bind to it. */
function fakeIii(options: { delayMs?: number } = {}) {
  const state = new Map<string, unknown>()
  const calls: Call[] = []
  const types: { id: string; handlers: Handlers }[] = []
  const sleep = () => new Promise((resolve) => setTimeout(resolve, options.delayMs ?? 0))
  const iii = {
    async trigger(request: Call) {
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
    registerTriggerType(info: { id: string }, handlers: Handlers) {
      types.push({ id: info.id, handlers })
      return { unregister() {} }
    },
  }
  return { iii: iii as unknown as CollectionIii, state, calls, types }
}

function collection(fake: ReturnType<typeof fakeIii>) {
  return createCollection<Item>({ iii: fake.iii, scope: 'my-worker', key: 'items', parse: parseItems, sort: sortItems })
}

const emitted = (fake: ReturnType<typeof fakeIii>) =>
  fake.calls.filter((call) => !call.function_id.startsWith('state::'))

describe('createCollection', () => {
  it('registers the my-worker:change trigger type', () => {
    const fake = fakeIii()
    collection(fake)
    assert.deepEqual(
      fake.types.map((type) => type.id),
      ['my-worker:change'],
    )
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

  it('emits { event, record, records } with config metadata laid over binding metadata', async () => {
    const fake = fakeIii()
    const items = collection(fake)
    const { handlers } = fake.types[0]
    const bind = (id: string, config: ChangeConfig, metadata?: Record<string, unknown>) =>
      handlers.registerTrigger({ id, function_id: `fn::${id}`, namespace: 'ns', config, metadata })
    await bind('one', { metadata: { from: 'config' } }, { from: 'binding', route: 'wake' })
    await bind('two', {}, { from: 'binding' })
    await bind('three', {})
    await bind('four', { events: ['removed'] })

    const { record } = await items.mutate('created', (current) => createItem(current, { title: 'a' }, 'id-1', 'now'))
    const calls = emitted(fake)
    assert.deepEqual(
      calls.map((call) => call.function_id),
      ['fn::one', 'fn::two', 'fn::three'],
    )
    for (const call of calls) {
      assert.equal(call.namespace, 'ns')
      assert.deepEqual(call.payload, { event: 'created', record, records: [record] })
    }
    // Config wins on a shared key; the binding's own keys (a wake's routing) survive.
    assert.deepEqual(calls[0].metadata, { from: 'config', route: 'wake' })
    assert.deepEqual(calls[1].metadata, { from: 'binding' })
    assert.equal('metadata' in calls[2], false)

    await handlers.unregisterTrigger({ id: 'one' })
    fake.calls.length = 0
    await items.mutate('updated', (current) => updateItem(current, { id: 'id-1', done: true }))
    assert.deepEqual(
      emitted(fake).map((call) => call.function_id),
      ['fn::two', 'fn::three'],
    )
  })

  it('emits nothing when the change fails', async () => {
    const fake = fakeIii()
    const items = collection(fake)
    await fake.types[0].handlers.registerTrigger({ id: 'one', function_id: 'fn::one', config: {} })
    await assert.rejects(items.mutate('removed', () => {
      throw new Error('nope')
    }), /nope/)
    assert.deepEqual(emitted(fake), [])
  })
})
