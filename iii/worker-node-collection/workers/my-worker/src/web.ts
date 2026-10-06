// HTTP handlers for the public page, served by the `http` worker on
// 127.0.0.1:3111. That port has no auth, so every route answers from an
// allowlist: `:file` and `:fn` come straight from the URL (`..` included).
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PUBLIC_ACTIONS } from './actions.js'
import { MODEL } from './model.js'
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
    Derived from the model and PUBLIC_ACTIONS (src/actions.ts), so a renamed
    resource needs no edit here. A Map, so `constructor` is never a name. */
export const API_FUNCTIONS: ReadonlyMap<string, string> = new Map([
  ...['list', 'get', 'create', 'update', 'remove'].map((name): [string, string] => [name, `${MODEL.resource}::${name}`]),
  ['model', 'model'],
  ...PUBLIC_ACTIONS.map((name): [string, string] => [name, `${MODEL.resource}::${name}`]),
])

/** Where the public page answers: the http worker's base URL (III_HTTP_URL)
    plus this worker's route; null when it is unset or empty, so the ADE page
    falls back to the host it is browsed from. */
export function webUrl(base?: string): string | null {
  return base ? `${base.replace(/\/+$/, '')}${WEB_PATH}` : null
}

const json = (status_code: number, body: unknown): HttpResponse => ({
  status_code,
  headers: { 'content-type': 'application/json' },
  body,
})

export function webHandlers(webDir: string, call: (fn: string, payload: unknown) => Promise<unknown>) {
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
      const fn = API_FUNCTIONS.get(req.path_params?.fn ?? '')
      if (!fn) return json(404, { error: 'not found' })
      try {
        return json(200, await call(fn, req.body ?? {}))
      } catch (error) {
        return json(500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  }
}
