// The public page: what people who use this worker open, served over HTTP by
// the http worker at /my-worker. It reaches the worker only through the
// allowlisted HTTP API (client.ts). The admin side lives in the ADE
// (ui/WorkerPage.tsx), where the greeting is set.
import { ArrowRight, Hand } from 'lucide-react'
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
    <div className="page">
      <header className="top">
        <span className="brand">
          <span className="mark" aria-hidden="true">
            <Hand size={18} />
          </span>
          my-worker
        </span>
      </header>
      <main className="main">
        <section className="card" aria-labelledby={`${inputId}-greeting`}>
          <h1
            id={`${inputId}-greeting`}
            key={message ?? 'idle'}
            className={message ? 'greeting greeting-new' : 'greeting'}
            aria-live="polite"
          >
            {message ?? 'Hello there.'}
          </h1>
          <p className="lede">
            {message ? 'Nice to meet you. Try another name.' : 'Tell us your name and we’ll greet you.'}
          </p>
          <form className="form" onSubmit={submit}>
            <label className="label" htmlFor={inputId}>
              Your name
            </label>
            <div className="row">
              <input
                id={inputId}
                className="input"
                value={name}
                placeholder="Ada"
                autoComplete="given-name"
                onChange={(event) => setName(event.target.value)}
              />
              <button className="button" type="submit" disabled={busy} aria-busy={busy}>
                {busy ? 'Greeting…' : 'Greet me'}
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
            {error ? (
              <p className="error" role="alert">
                Something went wrong: {error}. Try again.
              </p>
            ) : null}
          </form>
        </section>
      </main>
      <footer className="foot">Powered by iii</footer>
    </div>
  )
}
