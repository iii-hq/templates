/** How App reaches this worker's functions, by short name (`hello` → `my-worker::hello`). */
export type Client = { call<T>(fn: string, payload: unknown): Promise<T> }

/** Standalone page: POST JSON to the worker's HTTP API (src/web.ts allowlists `fn`). */
export function httpClient(base: string): Client {
  return {
    async call<T>(fn: string, payload: unknown) {
      const res = await fetch(`${base}/${fn}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? `${res.status} ${res.statusText}`)
      return body as T
    },
  }
}
