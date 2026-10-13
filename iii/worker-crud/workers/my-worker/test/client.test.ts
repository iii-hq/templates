import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { httpClient, loadSequence } from '../web/client.js'

const realFetch = globalThis.fetch

/** Answers every fetch with `body` and `status`. */
function answer(body: string, status = 200) {
  globalThis.fetch = (async () => new Response(body, { status, statusText: status === 200 ? 'OK' : 'Bad Request' })) as typeof fetch
}

describe('httpClient', () => {
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('resolves the parsed JSON body of a 2xx answer', async () => {
    answer('{"records":[]}')
    assert.deepEqual(await httpClient('/x/api').call('list', {}), { records: [] })
  })

  it('rejects a 2xx answer whose body is not JSON', async () => {
    answer('<html>proxy</html>')
    await assert.rejects(httpClient('/x/api').call('list', {}), /list: the server answered 200 without a JSON body/)
  })

  it('rejects a 2xx answer with an empty or null body', async () => {
    answer('')
    await assert.rejects(httpClient('/x/api').call('list', {}), /without a JSON body/)
    answer('null')
    await assert.rejects(httpClient('/x/api').call('list', {}), /without a JSON body/)
  })

  it('rejects a non-2xx answer with the server error, else the status', async () => {
    answer('{"error":"title is required"}', 400)
    await assert.rejects(httpClient('/x/api').call('create', {}), /^Error: title is required$/)
    answer('nope', 400)
    await assert.rejects(httpClient('/x/api').call('create', {}), /^Error: 400 Bad Request$/)
  })
})

describe('loadSequence', () => {
  it('lets only the newest load apply, whatever order the answers arrive in', () => {
    const sequence = loadSequence()
    const poll = sequence.begin()
    const refresh = sequence.begin()
    assert.equal(sequence.isLatest(refresh), true)
    assert.equal(sequence.isLatest(poll), false)
    const next = sequence.begin()
    assert.equal(sequence.isLatest(refresh), false)
    assert.equal(sequence.isLatest(next), true)
  })
})
