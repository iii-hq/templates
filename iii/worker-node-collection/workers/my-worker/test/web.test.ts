import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { PUBLIC_ACTIONS, PUBLIC_CRUD, PUBLIC_ROUTES } from '../src/actions.js'
import { MODEL } from '../src/model.js'
import { API_FUNCTIONS, checkRoutes, type HttpRequest, type PublicRoute, redirect, registerRoutes, routeId, WEB_PATH, webHandlers, webUrl } from '../src/web.js'

describe('webUrl', () => {
  it('is null unless III_HTTP_URL is set, so the page follows the console host', () => {
    assert.equal(webUrl(), null)
    assert.equal(webUrl(undefined), null)
    assert.equal(webUrl(''), null)
    assert.equal(WEB_PATH, '/my-worker')
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
      return { fn, payload }
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

  // The http worker has no auth: a record call the public page does not make
  // stays off it, so nothing bypasses a domain action's own checks (MOT-5341).
  it('keeps get and update off the public API unless PUBLIC_CRUD lists them', async () => {
    let called = false
    const closed = webHandlers(dir, async () => {
      called = true
      return {}
    })
    for (const fn of ['get', 'update']) {
      assert.deepEqual(await closed.api({ path_params: { fn }, body: { id: 'a' } }), {
        status_code: 404,
        headers: { 'content-type': 'application/json' },
        body: { error: 'not found' },
      })
    }
    assert.equal(called, false)
  })

  it('derives the public names from PUBLIC_CRUD and PUBLIC_ACTIONS, each passing the request body', async () => {
    const r = MODEL.resource
    assert.deepEqual(PUBLIC_CRUD, ['list', 'create', 'remove'])
    assert.deepEqual(
      [...API_FUNCTIONS],
      [
        ['list', `${r}::list`],
        ['create', `${r}::create`],
        ['remove', `${r}::remove`],
        ['model', 'model'],
        ...PUBLIC_ACTIONS.map((name) => [name, `${r}::${name}`]),
      ],
    )
    for (const [name, suffix] of API_FUNCTIONS) {
      const res = await web.api({ path_params: { fn: name }, body: { id: 'a' } })
      assert.deepEqual(res, {
        status_code: 200,
        headers: { 'content-type': 'application/json' },
        body: { fn: suffix, payload: { id: 'a' } },
      })
    }
  })

  it('sends an empty object when the request has no body', async () => {
    const res = await web.api({ path_params: { fn: 'list' } })
    assert.deepEqual(res.body, { fn: `${MODEL.resource}::list`, payload: {} })
  })

  it('answers 404 for a function outside the allowlist without calling it', async () => {
    called.length = 0
    for (const fn of ['info', 'ui-content', 'constructor', '..']) {
      const res = await web.api({ path_params: { fn }, body: {} })
      assert.equal(res.status_code, 404, fn)
    }
    assert.deepEqual(called, [])
  })

  it('turns a failed call into a 500 with the error message', async () => {
    const failing = webHandlers(dir, async () => {
      throw new Error('boom')
    })
    assert.deepEqual(await failing.api({ path_params: { fn: 'create' } }), {
      status_code: 500,
      headers: { 'content-type': 'application/json' },
      body: { error: 'boom' },
    })
  })
})

describe('redirect', () => {
  it('answers 302 with location by default, or the given status', () => {
    assert.deepEqual(redirect('https://iii.dev'), {
      status_code: 302,
      headers: { location: 'https://iii.dev', 'cache-control': 'no-store' },
      body: '',
    })
    assert.equal(redirect('/x', 301).status_code, 301)
    assert.throws(() => redirect(''), /needs a location/)
  })
})

describe('public routes', () => {
  type Ctx = { label: string }
  const ping: PublicRoute<Ctx> = {
    method: 'GET',
    path: 'ping/:x',
    handler: async (req, ctx) => ({ status_code: 200, headers: { 'content-type': 'application/json' }, body: { x: req.path_params?.x, ctx: ctx.label } }),
  }

  function fakeIii() {
    const functions = new Map<string, (req: HttpRequest) => Promise<unknown>>()
    const triggers: { type: string; function_id: string; config: Record<string, unknown> }[] = []
    return {
      functions,
      triggers,
      iii: {
        registerFunction(id: string, handler: (req: HttpRequest) => Promise<unknown>) {
          functions.set(id, handler)
        },
        registerTrigger(trigger: { type: string; function_id: string; config: Record<string, unknown> }) {
          triggers.push(trigger)
        },
      },
    }
  }

  it("this app's PUBLIC_ROUTES pass the startup checks (the template ships none)", () => {
    assert.doesNotThrow(() => checkRoutes(PUBLIC_ROUTES))
  })

  it('wires one internal function and one http trigger per route, and the route answers', async () => {
    const fake = fakeIii()
    const failing: PublicRoute<Ctx> = { method: 'POST', path: '/hooks/in/', handler: async () => { throw new Error('boom') } }
    const ids = registerRoutes(fake.iii, [ping, failing], { label: 'ctx' })
    assert.deepEqual(ids, ['my-worker::route::get::ping-x', 'my-worker::route::post::hooks-in'])
    assert.equal(routeId(ping), ids[0])
    assert.deepEqual(fake.triggers, [
      { type: 'http', function_id: ids[0], config: { api_path: `${WEB_PATH}/ping/:x`, http_method: 'GET' } },
      { type: 'http', function_id: ids[1], config: { api_path: `${WEB_PATH}/hooks/in`, http_method: 'POST' } },
    ])
    const answer = await fake.functions.get(ids[0])?.({ path_params: { x: 'abc' } })
    assert.deepEqual(answer, { status_code: 200, headers: { 'content-type': 'application/json' }, body: { x: 'abc', ctx: 'ctx' } })
    const failed = await fake.functions.get(ids[1])?.({})
    assert.deepEqual(failed, { status_code: 500, headers: { 'content-type': 'application/json' }, body: { error: 'boom' } })
  })

  it('refuses clashing paths at startup, before registering anything', () => {
    const route = (method: 'GET' | 'POST', path: string) => ({ method, path })
    assert.throws(() => checkRoutes([route('POST', 'api/x')]), /"api\/\.\.\." is taken/)
    assert.throws(() => checkRoutes([route('GET', 'api/:fn')]), /"api\/\.\.\." is taken/)
    assert.throws(() => checkRoutes([route('GET', ':slug')]), /first segment must be static/)
    assert.throws(() => checkRoutes([route('GET', ':slug/x')]), /first segment must be static/)
    assert.throws(() => checkRoutes([route('GET', 'health')]), /clashes with the asset route GET \/my-worker\/:file/)
    assert.throws(() => checkRoutes([route('GET', '')]), /must not be empty/)
    assert.throws(() => checkRoutes([route('GET', 'go/:slug'), route('GET', 'go/:id')]), /clashes with "go\/:slug"/)
    assert.throws(() => checkRoutes([route('POST', 'a-b/c'), route('POST', 'ab/c')]), /function id/)
    assert.doesNotThrow(() => checkRoutes([route('GET', 'go/:slug'), route('POST', 'go/:slug'), route('POST', 'health')]))
    const fake = fakeIii()
    assert.throws(() => registerRoutes(fake.iii, [ping, { ...ping }], { label: '' }), /clashes/)
    assert.equal(fake.functions.size, 0)
  })
})
