// THE screen. The ADE (ui/page.tsx) and the standalone page (web/main.tsx)
// both render it; only the client differs. Plain React, lucide-react icons and
// the scoped classes in ui/styles.css — no @iii-dev/console-ui components,
// which exist only inside the ADE.
import { Hand } from 'lucide-react'
import { type FormEvent, useId, useState } from 'react'
import type { Client } from './client'

export function App({ client }: { client: Client }) {
  const inputId = useId()
  const [name, setName] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await client.call<{ message: string }>('hello', { name })
      setMessage(result.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="my-worker-app">
      <h1 className="my-worker-title">
        <Hand size={16} aria-hidden="true" />
        my-worker
      </h1>
      <form className="my-worker-form" onSubmit={submit}>
        <label className="my-worker-label" htmlFor={inputId}>
          Name
        </label>
        <input
          id={inputId}
          className="my-worker-input"
          value={name}
          placeholder="World"
          autoComplete="off"
          onChange={(event) => setName(event.target.value)}
        />
        <button className="my-worker-button" type="submit" disabled={busy}>
          {busy ? 'Calling…' : 'Say hello'}
        </button>
      </form>
      {message && (
        <p className="my-worker-result" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="my-worker-error" role="alert">
          {error}
        </p>
      )}
    </main>
  )
}
