import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { hello } from '../src/hello.js'
import { webHandlers, webUrl } from '../src/web.js'

describe('webUrl', () => {
  it('defaults to the local http worker', () => {
    assert.equal(webUrl(), 'http://127.0.0.1:3111/my-worker')
    assert.equal(webUrl(undefined), 'http://127.0.0.1:3111/my-worker')
  })

  it('takes III_HTTP_URL with or without a trailing slash', () => {
    assert.equal(webUrl('https://iii.example.com/'), 'https://iii.example.com/my-worker')
    assert.equal(webUrl('http://10.0.0.5:3111'), 'http://10.0.0.5:3111/my-worker')
  })
})

describe('web handlers', () => {
  let dir = ''
  let web: ReturnType<typeof webHandlers>
  const called: string[] = []

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), 'my-worker-web-'))
    await writeFile(join(dir, 'index.html'), '<!doctype html><title>page</title>')
    await writeFile(join(dir, 'app.js'), 'console.log("app")')
    await writeFile(join(dir, 'styles.css'), 'body{}')
    await writeFile(join(dir, 'secret.txt'), 'secret')
    web = webHandlers(dir, async (fn, payload) => {
      called.push(fn)
      return hello(payload as { name?: string })
    })
  })

  after(() => rm(dir, { recursive: true, force: true }))

  it('serves the page as an HTML string', async () => {
    assert.deepEqual(await web.page(), {
      status_code: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: '<!doctype html><title>page</title>',
    })
  })

  it('serves the two built assets with their content types', async () => {
    const app = await web.asset({ path_params: { file: 'app.js' } })
    assert.equal(app.status_code, 200)
    assert.equal(app.headers['content-type'], 'text/javascript; charset=utf-8')
    assert.equal(app.body, 'console.log("app")')
    const css = await web.asset({ path_params: { file: 'styles.css' } })
    assert.equal(css.headers['content-type'], 'text/css; charset=utf-8')
    assert.equal(css.body, 'body{}')
  })

  it('answers 404 for any file outside the allowlist', async () => {
    for (const file of ['..', 'secret.txt', 'index.html', 'constructor', '']) {
      const res = await web.asset({ path_params: { file } })
      assert.equal(res.status_code, 404, file)
      assert.notEqual(res.body, 'secret', file)
    }
  })

  it('calls an allowlisted function with the request body', async () => {
    assert.deepEqual(await web.api({ path_params: { fn: 'hello' }, body: { name: 'Ada' } }), {
      status_code: 200,
      headers: { 'content-type': 'application/json' },
      body: { message: 'Hello, Ada!' },
    })
  })

  it('answers 404 for a function outside the allowlist without calling it', async () => {
    called.length = 0
    for (const fn of ['ui-content', 'constructor', '..']) {
      const res = await web.api({ path_params: { fn }, body: {} })
      assert.equal(res.status_code, 404, fn)
    }
    assert.deepEqual(called, [])
  })

  it('turns a failed call into a 500 with the error message', async () => {
    const failing = webHandlers(dir, async () => {
      throw new Error('boom')
    })
    assert.deepEqual(await failing.api({ path_params: { fn: 'hello' } }), {
      status_code: 500,
      headers: { 'content-type': 'application/json' },
      body: { error: 'boom' },
    })
  })
})
