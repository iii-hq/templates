// How the public page reaches this worker: `call(name, payload)` over the
// allowlisted HTTP API (src/web.ts), and `api`, the record calls named after
// MODEL.resource. A renamed resource needs no change at the call sites.
import { MODEL } from '../src/model'
import type { Counts, DataRecord } from '../src/record'

export type { Counts, DataRecord }
export type ListResult = { records: DataRecord[]; counts: Counts }

/** A short name (`list`, `toggle`) -> `my-worker::<resource>::<name>` on the server. */
export type Client = { call<T>(fn: string, payload: unknown): Promise<T> }

/** Public page: POST JSON to the worker's HTTP API (src/web.ts allowlists `fn`).
    A non-2xx answer rejects with the server's `error` (or the status); a 2xx
    answer whose body is empty or not JSON rejects too, never resolving `null`. */
export function httpClient(base: string): Client {
  return {
    async call<T>(fn: string, payload: unknown) {
      const res = await fetch(`${base}/${fn}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = parseJson(await res.text().catch(() => ''))
      if (!res.ok) throw new Error(errorOf(body) ?? `${res.status} ${res.statusText}`)
      if (body === undefined || body === null) {
        throw new Error(`${fn}: the server answered ${res.status} without a JSON body`)
      }
      return body as T
    },
  }
}

/** The parsed body, or undefined when it is empty or not JSON. */
function parseJson(text: string): unknown {
  if (text.trim() === '') return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

function errorOf(body: unknown): string | undefined {
  const error = (body as { error?: unknown } | null | undefined)?.error
  return typeof error === 'string' && error !== '' ? error : undefined
}

export type Api = ReturnType<typeof createApi>

/** The record calls for MODEL.resource. */
export function createApi(client: Client) {
  type One = { record: DataRecord }
  return {
    resource: MODEL.resource,
    list: () => client.call<ListResult>('list', {}),
    get: (id: string) => client.call<One>('get', { id }),
    create: (fields: Record<string, unknown>) => client.call<One>('create', fields),
    update: (id: string, fields: Record<string, unknown>) => client.call<One>('update', { ...fields, id }),
    remove: (id: string) => client.call<One>('remove', { id }),
    toggle: (id: string, field: string) => client.call<One>('toggle', { id, field }),
  }
}

/** Orders overlapping loads (a poll and a refresh after a write): each load
    takes a ticket with `begin()`, and only the newest ticket may apply its
    result, so an older answer that arrives late never replaces a newer one. */
export function loadSequence() {
  let latest = 0
  return {
    begin: () => ++latest,
    isLatest: (ticket: number) => ticket === latest,
  }
}
