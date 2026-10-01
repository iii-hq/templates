// HTTP handlers for the standalone page, served by the `http` worker on
// 127.0.0.1:3111. That port has no auth, so every route answers from an
// allowlist: `:file` and `:fn` come straight from the URL (`..` included).
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/** The fields of the http worker's request these handlers read. */
export type HttpRequest = { path_params?: Record<string, string>; body?: unknown }
export type HttpResponse = { status_code: number; headers: Record<string, string>; body: unknown }

/** Built files the page loads from dist/web, with their content types. */
const ASSETS = new Map([
  ['app.js', 'text/javascript; charset=utf-8'],
  ['styles.css', 'text/css; charset=utf-8'],
])

/** Functions the page may call over HTTP, by short name (`my-worker::<name>`). */
export const API_FUNCTIONS = new Set(['hello'])

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
      const fn = req.path_params?.fn ?? ''
      if (!API_FUNCTIONS.has(fn)) return json(404, { error: 'not found' })
      try {
        return json(200, await call(fn, req.body ?? {}))
      } catch (error) {
        return json(500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  }
}
