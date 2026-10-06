// The public page for the default model (items with title and done): what
// people who use this worker open, served over HTTP by the http worker at
// /my-worker. It is written per app: after changing src/model.ts, rewrite
// this page and web/app.css for the new records. It reaches the worker only
// through the allowlisted HTTP API (client.ts) and refreshes with a light poll.
import { Check, ListChecks, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { MODEL } from '../src/model'
import { type Client, createApi, type DataRecord, type ListResult, loadSequence } from './client'

/** The fields this page shows: the model's title field and its `done` flag. */
const TITLE = MODEL.titleField
const DONE = 'done'

type Filter = 'all' | 'open' | 'done'

const POLL_MS = 4000
const EMPTY: ListResult = { records: [], counts: { total: 0 } }
const FILTERS: readonly { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'done', label: 'Done' },
]

const titleOf = (record: DataRecord) => String(record[TITLE] ?? '')
const isDone = (record: DataRecord) => record[DONE] === true
const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err))

function headlineOf(total: number, open: number): string {
  if (total === 0) return 'Nothing here yet.'
  if (open === 0) return 'All done.'
  return open === 1 ? '1 thing left.' : `${open} things left.`
}

export function App({ client }: { client: Client }) {
  const api = useMemo(() => createApi(client), [client])
  const inputId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [list, setList] = useState<ListResult>(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const [title, setTitle] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [formError, setFormError] = useState<string | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sequence] = useState(loadSequence)

  // Only the newest load applies its answer; a successful one clears the
  // poll error. Form errors are separate and cleared by an edit or a retry.
  const load = useCallback(async () => {
    const ticket = sequence.begin()
    try {
      const next = await api.list()
      if (!sequence.isLatest(ticket)) return
      setList(next)
      setLoaded(true)
      setPollError(null)
    } catch (err) {
      if (sequence.isLatest(ticket)) setPollError(messageOf(err))
    }
  }, [api, sequence])

  useEffect(() => {
    void load()
    const id = setInterval(() => {
      if (!document.hidden) void load()
    }, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  async function act(work: () => Promise<unknown>) {
    setBusy(true)
    setFormError(null)
    try {
      await work()
      await load()
      return true
    } catch (err) {
      setFormError(messageOf(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function add(event: FormEvent) {
    event.preventDefault()
    const next = title.trim()
    if (!next) return
    if (await act(() => api.create({ [TITLE]: next }))) setTitle('')
    // The field keeps focus so the next item can be typed straight away.
    input.current?.focus()
  }

  const { records, counts } = list
  const total = counts.total ?? records.length
  const done = counts[DONE] ?? records.filter(isDone).length
  const open = total - done
  const shown = records.filter((record) => (filter === 'all' ? true : filter === 'done' ? isDone(record) : !isDone(record)))
  const headline = headlineOf(total, open)

  return (
    <div className="page">
      <header className="top">
        <span className="brand">
          <span className="mark" aria-hidden="true">
            <ListChecks size={18} />
          </span>
          my-worker
        </span>
      </header>
      <main className="main">
        <section className="card" aria-labelledby={`${inputId}-headline`}>
          <h1 id={`${inputId}-headline`} key={headline} className="headline headline-new" aria-live="polite">
            {headline}
          </h1>
          <p className="lede">
            {open} open · {done} done · {total} total
          </p>
          <form className="form" onSubmit={add}>
            <label className="label" htmlFor={inputId}>
              New item
            </label>
            <div className="row">
              <input
                ref={input}
                id={inputId}
                className="input"
                value={title}
                maxLength={200}
                placeholder="What needs doing?"
                autoComplete="off"
                onChange={(event) => {
                  setTitle(event.target.value)
                  setFormError(null)
                }}
              />
              <button className="button" type="submit" disabled={busy || !title.trim()} aria-busy={busy}>
                Add
                <Plus size={18} aria-hidden="true" />
              </button>
            </div>
            {formError ? (
              <p className="error" role="alert">
                Something went wrong: {formError}. Try again.
              </p>
            ) : null}
          </form>
          {pollError ? (
            <p className="error" role="status">
              The list could not be refreshed: {pollError}. Retrying.
            </p>
          ) : null}
          <div className="toolbar">
            <div className="filters" role="group" aria-label="Show">
              {FILTERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="filter"
                  aria-pressed={filter === option.id}
                  onClick={() => setFilter(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {done > 0 ? (
              <button
                type="button"
                className="link"
                disabled={busy}
                onClick={() => void act(() => Promise.all(records.filter(isDone).map((record) => api.remove(record.id))))}
              >
                Clear done ({done})
              </button>
            ) : null}
          </div>
          {!loaded ? (
            <p className="empty">Loading…</p>
          ) : shown.length === 0 ? (
            <p className="empty">{total === 0 ? 'No items yet. Add the first one above.' : `No ${filter} items.`}</p>
          ) : (
            <ul className="items" aria-label="Items">
              {shown.map((record) => (
                <li key={record.id} className={isDone(record) ? 'item item-done' : 'item'}>
                  <button
                    type="button"
                    className="toggle"
                    aria-pressed={isDone(record)}
                    aria-label={isDone(record) ? `Reopen ${titleOf(record)}` : `Complete ${titleOf(record)}`}
                    disabled={busy}
                    onClick={() => void act(() => api.toggle(record.id, DONE))}
                  >
                    {isDone(record) ? <RotateCcw size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                  </button>
                  <span className="item-title">{titleOf(record)}</span>
                  <button
                    type="button"
                    className="remove"
                    aria-label={`Remove ${titleOf(record)}`}
                    disabled={busy}
                    onClick={() => void act(() => api.remove(record.id))}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <footer className="foot">Powered by iii</footer>
    </div>
  )
}
