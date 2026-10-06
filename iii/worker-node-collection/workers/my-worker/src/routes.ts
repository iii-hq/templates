// Public routes: PUBLIC_ROUTES from src/actions.ts, each on its own path
// under WEB_PATH. This file imports nothing from the app (no actions, no
// model), so src/actions.ts can import redirect() and PublicRoute from here
// without an import cycle.

/** The fields of the http worker's request these handlers read. */
export type HttpRequest = {
  path_params?: Record<string, string>
  query_params?: Record<string, string | string[]>
  headers?: Record<string, string | string[]>
  body?: unknown
}
export type HttpResponse = { status_code: number; headers: Record<string, string>; body: unknown }

/** The public page's route on the http worker. */
export const WEB_PATH = '/my-worker'

const json = (status_code: number, body: unknown): HttpResponse => ({
  status_code,
  headers: { 'content-type': 'application/json' },
  body,
})

/** A route an app adds in src/actions.ts. `path` is relative to WEB_PATH
    (`go/:slug` answers on /my-worker/go/:slug) and needs a static first
    segment; `api` is taken, and a one-segment GET would clash with the asset
    route GET /my-worker/:file. */
export type PublicRoute<Ctx = unknown> = {
  method: 'GET' | 'POST'
  path: string
  handler: (req: HttpRequest, ctx: Ctx) => Promise<HttpResponse>
}

/** The part of the SDK client route registration needs (a test passes a fake). */
export type RouteIii = {
  registerFunction(id: string, handler: (req: HttpRequest) => Promise<HttpResponse>, options?: { description?: string; metadata?: Record<string, unknown> }): unknown
  registerTrigger(trigger: { type: string; function_id: string; config: Record<string, unknown> }): unknown
}

/** A redirect answer for a route handler: `302` (or `status`) to `location`. */
export function redirect(location: string, status: 301 | 302 | 303 | 307 | 308 = 302): HttpResponse {
  if (!location) throw new Error('redirect needs a location')
  return { status_code: status, headers: { location, 'cache-control': 'no-store' }, body: '' }
}

const segmentsOf = (path: string) => path.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)

/** The route's function id: `my-worker::route::get::go-slug`. */
export function routeId(route: Pick<PublicRoute, 'method' | 'path'>): string {
  const slug = segmentsOf(route.path)
    .map((segment) => segment.replace(/[^a-zA-Z0-9]+/g, ''))
    .filter(Boolean)
    .join('-')
    .toLowerCase()
  return `my-worker::route::${route.method.toLowerCase()}::${slug}`
}

/** Throws, naming the route, on a path the http worker cannot give this app
    unambiguously. Runs at startup, before anything is registered. */
export function checkRoutes(routes: readonly Pick<PublicRoute, 'method' | 'path'>[]): void {
  const seen = new Map<string, string>()
  for (const route of routes) {
    const label = `PUBLIC_ROUTES ${route.method} "${route.path}"`
    if (route.method !== 'GET' && route.method !== 'POST') throw new Error(`${label}: method must be GET or POST`)
    const segments = segmentsOf(route.path)
    if (segments.length === 0) throw new Error(`${label}: path must not be empty (GET ${WEB_PATH} is the public page)`)
    const first = segments[0]
    if (first.startsWith(':') || first.includes('*')) {
      throw new Error(`${label}: the first segment must be static, e.g. "go/:slug" not ":slug"`)
    }
    if (first === 'api') throw new Error(`${label}: "api/..." is taken by POST ${WEB_PATH}/api/:fn`)
    if (route.method === 'GET' && segments.length === 1) {
      throw new Error(`${label}: a one-segment GET clashes with the asset route GET ${WEB_PATH}/:file; add a segment, e.g. "${first}/:id"`)
    }
    // Two routes clash when they match the same URLs: compare with params blanked.
    const shape = `${route.method} ${segments.map((s) => (s.startsWith(':') ? ':' : s)).join('/')}`
    const earlier = seen.get(shape)
    if (earlier !== undefined) throw new Error(`${label}: clashes with "${earlier}"`)
    const id = routeId(route)
    for (const [otherShape, otherPath] of seen) {
      if (routeId({ method: otherShape.split(' ')[0] as 'GET' | 'POST', path: otherPath }) === id) {
        throw new Error(`${label}: function id ${id} clashes with "${otherPath}"`)
      }
    }
    seen.set(shape, route.path)
  }
}

/** Registers one internal function and one http trigger per route, at
    WEB_PATH/<path>. A handler that throws answers 500 with its message. */
export function registerRoutes<Ctx>(iii: RouteIii, routes: readonly PublicRoute<Ctx>[], ctx: Ctx): string[] {
  checkRoutes(routes)
  return routes.map((route) => {
    const id = routeId(route)
    const path = segmentsOf(route.path).join('/')
    iii.registerFunction(
      id,
      async (req: HttpRequest) => {
        try {
          return await route.handler(req ?? {}, ctx)
        } catch (error) {
          return json(500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
      { description: `${route.method} ${WEB_PATH}/${path}: a public route from src/actions.ts.`, metadata: { internal: true } },
    )
    iii.registerTrigger({ type: 'http', function_id: id, config: { api_path: `${WEB_PATH}/${path}`, http_method: route.method } })
    return id
  })
}
