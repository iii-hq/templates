// HTTP handlers for the public page, served by the `http` worker (http::status
// reports its address). It has no auth, so every route answers from an
// allowlist: `:file` and `:fn` come straight from the URL (`..` included).
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PUBLIC_ACTIONS, PUBLIC_CRUD } from './actions.js'
import { MODEL } from './model.js'
import { type Model, privateFields } from './record.js'
import { type HttpRequest, type HttpResponse, WEB_PATH } from './routes.js'

// The route plumbing lives in src/routes.ts (no import from src/actions.ts,
// so actions can use redirect() without an import cycle); re-exported here.
export { checkRoutes, type HttpRequest, type HttpResponse, type PublicRoute, redirect, registerRoutes, type RouteIii, routeId, WEB_PATH } from './routes.js'

/** Built files the page loads from dist/web, with their content types. */
const ASSETS = new Map([
  ['app.js', 'text/javascript; charset=utf-8'],
  ['styles.css', 'text/css; charset=utf-8'],
])

/** Functions the page may call over HTTP: short name -> `my-worker::<suffix>`.
    Derived from the model, PUBLIC_CRUD and PUBLIC_ACTIONS (src/actions.ts), so
    a renamed resource needs no edit here. A Map, so `constructor` is never a
    name. */
export function apiFunctions(model: Model): ReadonlyMap<string, string> {
  return new Map([
    ...PUBLIC_CRUD.map((name): [string, string] => [name, `${model.resource}::${name}`]),
    ['model', 'model'],
    ...PUBLIC_ACTIONS.map((name): [string, string] => [name, `${model.resource}::${name}`]),
  ])
}
export const API_FUNCTIONS: ReadonlyMap<string, string> = apiFunctions(MODEL)

/** Where the public page answers: the http worker's base URL (III_HTTP_URL)
    plus this worker's route; null when it is unset or empty, so the ADE page
    falls back to the host it is browsed from. */
export function webUrl(base?: string): string | null {
  return base ? `${base.replace(/\/+$/, '')}${WEB_PATH}` : null
}

type Fields = Record<string, unknown>
const isObject = (value: unknown): value is Fields => typeof value === 'object' && value !== null && !Array.isArray(value)
const omit = (value: unknown, names: readonly string[]): unknown =>
  isObject(value) ? Object.fromEntries(Object.entries(value).filter(([key]) => !names.includes(key))) : value

/** A function's answer as HTTP callers see it: the `names` fields (the
    model's private ones) left out of a top-level `record` and of each entry
    of a top-level `records`. Everything else, nested shapes included, is
    returned as is, so an action that returns records should return them as
    `record` or `records`. Pure; the input is not changed. */
export function stripPrivate(body: unknown, names: readonly string[]): unknown {
  if (names.length === 0 || !isObject(body)) return body
  const out: Fields = { ...body }
  if ('record' in out) out.record = omit(out.record, names)
  if (Array.isArray(out.records)) out.records = out.records.map((record) => omit(record, names))
  return out
}

const json = (status_code: number, body: unknown): HttpResponse => ({
  status_code,
  headers: { 'content-type': 'application/json' },
  body,
})

/** `call` reaches the engine; its answer goes through stripPrivate before it
    is sent, so private fields never leave over HTTP. `model` is for tests. */
export function webHandlers(webDir: string, call: (fn: string, payload: unknown) => Promise<unknown>, model: Model = MODEL) {
  const functions = apiFunctions(model)
  const hidden = privateFields(model)
  const file = async (name: string, type: string): Promise<HttpResponse> => ({
    status_code: 200,
    headers: { 'content-type': type },
    body: await readFile(join(webDir, name), 'utf8'),
  })

  return {
    page: () => file('index.html', 'text/html; charset=utf-8'),

    asset: async (req: HttpRequest) => {
      const name = req.path_params?.file ?? ''
      const type = ASSETS.get(name)
      return type ? file(name, type) : json(404, { error: 'not found' })
    },

    api: async (req: HttpRequest) => {
      const fn = functions.get(req.path_params?.fn ?? '')
      if (!fn) return json(404, { error: 'not found' })
      try {
        return json(200, stripPrivate(await call(fn, req.body ?? {}), hidden))
      } catch (error) {
        return json(500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  }
}
