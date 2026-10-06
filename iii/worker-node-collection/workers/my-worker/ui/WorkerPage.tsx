// The worker's admin page in the ADE, generic: it loads the model once with
// my-worker::model and renders the add form, the live list and the endpoints
// from it, so it needs no edit when src/model.ts changes. Built from the
// console's own components (@iii-dev/console-ui is supplied by the console at
// runtime). People who use the worker get the public page: web/App.tsx.
import type { Host } from '@iii-dev/console-ui'
import {
  Button,
  IconButton,
  Input,
  PageHeader,
  PageMain,
  PageShell,
  SettingsField,
  SettingsList,
  SettingsRow,
  SettingsSection,
  StatusPanel,
  Wordmark,
} from '@iii-dev/console-ui'
import { errorMessage } from '@iii-dev/console-ui/format'
import { useContainerNarrow, useCopyFlash, useWorkerLive } from '@iii-dev/console-ui/hooks'
import { Check, Circle, Copy, ExternalLink, Pencil, Plus, Trash2, X } from 'lucide-react'
import { type FormEvent, Fragment, type KeyboardEvent, type MouseEvent, useCallback, useEffect, useState } from 'react'

// The model as my-worker::model sends it (src/record.ts has the source types).
type Value = string | number | boolean
type Field = {
  type: 'string' | 'number' | 'boolean'
  label: string
  required?: boolean
  default?: Value
  min?: number
  max?: number
  unique?: boolean
  private?: boolean
}
type Model = {
  resource: string
  title: string
  titleField: string
  fields: Record<string, Field>
  listColumns: string[]
}
type ModelInfo = { model: Model; field_order?: string[]; public_actions: string[] }

/** The fields in model order: the engine's JSON may sort object keys, so
    my-worker::model sends the order alongside. */
function fieldsOf(meta: ModelInfo): [string, Field][] {
  const order = meta.field_order?.filter((name) => name in meta.model.fields) ?? Object.keys(meta.model.fields)
  return order.map((name) => [name, meta.model.fields[name]])
}
type DataRecord = { id: string; created_at: number; updated_at: number; [field: string]: Value }
type Counts = { total: number; [booleanField: string]: number }
type List = { records: DataRecord[]; counts: Counts }

/** my-worker::info: where the public page lives. */
type Info = { web_url: string | null; web_path: string }

/** The http worker's default port, used when III_HTTP_URL is unset. */
const HTTP_WORKER_PORT = 3111
/** Opens a tab in the browser worker; "Open public page" uses it when present. */
const BROWSER_START = 'browser::sessions::start'

const EMPTY: List = { records: [], counts: { total: 0 } }

/** Any answer that is not the list shape reads as the empty list. */
function toList(value: unknown): List {
  const list = value as Partial<List> | null | undefined
  if (!list || !Array.isArray(list.records)) return EMPTY
  return { records: list.records, counts: list.counts ?? { total: list.records.length } }
}

type Draft = Record<string, string | boolean>

function initialDraft(meta: ModelInfo): Draft {
  const draft: Draft = {}
  for (const [name, field] of fieldsOf(meta)) {
    draft[name] = field.type === 'boolean' ? field.default === true : field.default === undefined ? '' : String(field.default)
  }
  return draft
}

/** The create payload: numbers parsed (an unparsable one is sent as typed so
    the function names the problem), empty optional numbers left out. */
function payloadOf(model: Model, draft: Draft): Record<string, Value> {
  const payload: Record<string, Value> = {}
  for (const [name, field] of Object.entries(model.fields)) {
    const value = draft[name]
    if (field.type === 'boolean') payload[name] = value === true
    else if (field.type === 'number') {
      const text = String(value ?? '').trim()
      if (text !== '') payload[name] = Number.isFinite(Number(text)) ? Number(text) : text
    } else payload[name] = String(value ?? '')
  }
  return payload
}

function hintOf(field: Field): string {
  const parts: string[] = [field.type === 'string' ? 'Text' : field.type === 'number' ? 'Number' : 'Yes or no']
  if (field.required) parts.push('required')
  if (field.unique) parts.push('unique')
  if (field.private) parts.push('private: left out of the public API')
  const unit = field.type === 'string' ? ' characters' : ''
  if (field.min !== undefined && field.max !== undefined) parts.push(`${field.min} to ${field.max}${unit}`)
  else if (field.max !== undefined) parts.push(`at most ${field.max}${unit}`)
  else if (field.min !== undefined) parts.push(`at least ${field.min}${unit}`)
  return parts.join(', ')
}

type Outcome = { headline: string; detail: string }

export function WorkerPage({ host, onClose }: { host: Host; onClose?: () => void }) {
  const { ref, narrow } = useContainerNarrow()
  const [info, setInfo] = useState<Info | null>(null)
  const [meta, setMeta] = useState<ModelInfo | null>(null)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<Outcome | null>(null)
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null)
  const [browser, setBrowser] = useState(false)

  const model = meta?.model ?? null
  const fn = (name: string) => `my-worker::${model?.resource ?? ''}::${name}`

  useEffect(() => {
    host.iii.trigger<Info>('my-worker::info', {}).then(setInfo, () => setInfo(null))
    host.iii.trigger<ModelInfo>('my-worker::model', {}).then(
      (next) => {
        setMeta(next)
        setDraft(initialDraft(next))
      },
      (error) => setMetaError(errorMessage(error)),
    )
  }, [host])

  // engine::functions::info answers NOT_FOUND when no browser worker runs.
  useEffect(() => {
    if (!host.panels) return
    host.iii.trigger('engine::functions::info', { function_id: BROWSER_START }).then(
      () => setBrowser(true),
      () => undefined,
    )
  }, [host])

  const resource = model?.resource
  // A failed fetch keeps the empty shape (the backend may still be starting)
  // but is reported above the list; the next successful fetch clears it.
  const [listError, setListError] = useState<string | null>(null)
  const fetchList = useCallback(async (): Promise<List> => {
    if (!resource) return EMPTY
    try {
      const list = toList(await host.iii.trigger<unknown>(`my-worker::${resource}::list`, {}))
      setListError(null)
      return list
    } catch (error) {
      setListError(errorMessage(error))
      return EMPTY
    }
  }, [host, resource])

  const { data, loading, refresh } = useWorkerLive({
    iii: host.iii,
    triggers: ['my-worker:change'],
    fetch: fetchList,
    pollMs: 3000,
    handlerId: 'iii::my-worker-ui::events',
  })
  // The first fetch can run before the model arrives; fetch again once it has.
  useEffect(() => {
    if (resource) refresh()
  }, [resource, refresh])
  const { records, counts } = toList(data)
  const titleShown = model ? model.listColumns.includes(model.titleField) : false

  async function run(headline: string, action: () => Promise<unknown>): Promise<boolean> {
    setBusy(true)
    try {
      await action()
      setFailure(null)
      refresh()
      return true
    } catch (error) {
      setFailure({ headline, detail: errorMessage(error) })
      return false
    } finally {
      setBusy(false)
    }
  }

  async function add(event: FormEvent) {
    event.preventDefault()
    if (!model || !meta) return
    if (await run('The record was not added', () => host.iii.trigger(fn('create'), payloadOf(model, draft)))) {
      setDraft(initialDraft(meta))
    }
  }

  async function rename(event: FormEvent) {
    event.preventDefault()
    if (!editing || !model) return
    const current = records.find((record) => record.id === editing.id)
    if (editing.value.trim() === String(current?.[model.titleField] ?? '')) {
      setEditing(null)
      return
    }
    const patch = { id: editing.id, [model.titleField]: editing.value }
    if (await run('The record was not renamed', () => host.iii.trigger(fn('update'), patch))) setEditing(null)
  }

  function cancelOnEscape(event: KeyboardEvent) {
    if (event.key === 'Escape') setEditing(null)
  }

  const publicHref = info && (info.web_url ?? `http://${window.location.hostname}:${HTTP_WORKER_PORT}${info.web_path}`)

  // Opens the public page in the browser worker's console page; without one,
  // or on a modified click, the link opens a new tab.
  function openInBrowser(event: MouseEvent<HTMLAnchorElement>) {
    if (!browser || !info || !publicHref || event.metaKey || event.ctrlKey || event.shiftKey) return
    event.preventDefault()
    const url = info.web_url ?? `http://127.0.0.1:${HTTP_WORKER_PORT}${info.web_path}`
    host.iii.trigger<{ session_id: string }>(BROWSER_START, { url, preview: false }).then(
      ({ session_id }) => host.panels?.open({ pageId: 'browser', context: { sessionId: session_id } }),
      (error) => {
        setBrowser(false)
        setFailure({
          headline: 'The browser worker could not open the public page',
          detail: `${errorMessage(error)}. Open public page now opens it in a new tab.`,
        })
      },
    )
  }

  const openPublic = publicHref ? (
    narrow ? (
      <IconButton label="Open public page" asChild>
        <a href={publicHref} target="_blank" rel="noreferrer" onClick={openInBrowser}>
          <ExternalLink aria-hidden />
        </a>
      </IconButton>
    ) : (
      <Button variant="ghost" size="sm" asChild>
        <a href={publicHref} target="_blank" rel="noreferrer" onClick={openInBrowser}>
          <ExternalLink aria-hidden />
          Open public page
        </a>
      </Button>
    )
  ) : null

  const summary = model
    ? [
        `${counts.total} total`,
        ...(meta ? fieldsOf(meta) : [])
          .filter(([, field]) => field.type === 'boolean')
          .map(([name, field]) => `${counts[name] ?? 0} ${field.label.toLowerCase()}`),
      ].join(' · ') + '. Every change is saved at once.'
    : 'Loading the model…'

  const endpoints = model
    ? [
        ...['list', 'get', 'create', 'update', 'remove'].map((name) => ({ label: 'Function', value: fn(name) })),
        ...(meta?.public_actions ?? []).map((name) => ({ label: 'Action', value: fn(name) })),
        { label: 'Function', value: 'my-worker::model' },
        { label: 'Trigger type', value: 'my-worker:change' },
        { label: 'Public page', value: 'GET /my-worker' },
        { label: 'Public API', value: 'POST /my-worker/api/:fn' },
      ]
    : []
  const endpointNotes: Record<string, string> = {
    'my-worker:change': 'Fires after every write with { event, record, records }; this page re-fetches on each.',
    'my-worker::model': 'The model these pages render from.',
    'GET /my-worker': 'What people who use this worker open, served by the http worker.',
    'POST /my-worker/api/:fn': `list, get, create, update, remove, model${(meta?.public_actions ?? []).map((a) => `, ${a}`).join('')}.`,
  }

  return (
    <PageShell ref={ref}>
      <PageHeader
        icon={<Wordmark className="my-worker-mark" />}
        title="my-worker"
        description="Admin"
        actions={openPublic}
        onClose={onClose}
      />
      <PageMain>
        <div className="my-worker-scroll">
          <div className="my-worker-column">
            {metaError ? <StatusPanel role="alert" variant="alert" headline="The model could not be loaded" detail={metaError} /> : null}
            {model ? (
              <SettingsSection title={`Add to ${model.title}`} description="Fields come from src/model.ts; * marks a required one.">
                <form className="my-worker-stack" onSubmit={add}>
                  <SettingsList>
                    {(meta ? fieldsOf(meta) : []).map(([name, field]) => (
                      <SettingsField
                        key={name}
                        label={field.required ? `${field.label} *` : field.label}
                        description={hintOf(field)}
                        renderControl={(props) =>
                          field.type === 'boolean' ? (
                            <Button
                              {...props}
                              type="button"
                              variant={draft[name] === true ? 'primary' : 'ghost'}
                              size="sm"
                              aria-pressed={draft[name] === true}
                              onClick={() => setDraft((current) => ({ ...current, [name]: current[name] !== true }))}
                            >
                              {draft[name] === true ? 'Yes' : 'No'}
                            </Button>
                          ) : (
                            <Input
                              {...props}
                              value={String(draft[name] ?? '')}
                              onChange={(next: string) => setDraft((current) => ({ ...current, [name]: next }))}
                              inputMode={field.type === 'number' ? 'decimal' : undefined}
                              aria-required={field.required}
                              autoComplete="off"
                            />
                          )
                        }
                      />
                    ))}
                  </SettingsList>
                  <div className="my-worker-actions">
                    <Button type="submit" variant="primary" size="sm" disabled={busy}>
                      <Plus aria-hidden />
                      Add
                    </Button>
                  </div>
                </form>
              </SettingsSection>
            ) : null}
            {failure ? <StatusPanel role="alert" variant="alert" headline={failure.headline} detail={failure.detail} /> : null}
            {listError ? <StatusPanel role="alert" variant="alert" headline="The list could not be loaded" detail={listError} /> : null}
            <SettingsSection title={model?.title ?? 'Records'} description={summary}>
              {!model || (loading && records.length === 0) ? (
                <p className="my-worker-note">Loading…</p>
              ) : records.length === 0 ? (
                <p className="my-worker-note">{listError ? 'Not loaded yet; retrying.' : 'Nothing yet. Add the first one above.'}</p>
              ) : (
                <div className="my-worker-table-wrap">
                  <table className="my-worker-table">
                    <thead>
                      <tr>
                        {model.listColumns.map((column) => (
                          <th key={column} scope="col">
                            {model.fields[column]?.label ?? column}
                            {model.fields[column]?.private ? <span className="my-worker-private"> · private</span> : null}
                          </th>
                        ))}
                        <th scope="col">
                          <span className="my-worker-sr">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* The rename editor sits in the title column, or in a row of its own when listColumns leaves the title out. */}
                      {records.map((record) => {
                        const name = String(record[model.titleField] ?? record.id)
                        const renameForm = editing && editing.id === record.id ? (
                          <form className="my-worker-rename" onSubmit={rename} onKeyDown={cancelOnEscape}>
                            <Input
                              value={editing.value}
                              onChange={(next: string) => setEditing({ id: record.id, value: next })}
                              aria-label={`Rename ${name}`}
                              autoComplete="off"
                            />
                            <IconButton label="Save" variant="ghost" type="submit" disabled={busy}>
                              <Check aria-hidden />
                            </IconButton>
                            <IconButton label="Cancel" variant="ghost" onClick={() => setEditing(null)}>
                              <X aria-hidden />
                            </IconButton>
                          </form>
                        ) : null
                        return (
                          <Fragment key={record.id}>
                            <tr>
                              {model.listColumns.map((column) => {
                                const field = model.fields[column]
                                const value = record[column]
                                if (field?.type === 'boolean') {
                                  return (
                                    <td key={column} className="my-worker-cell-flag">
                                      <IconButton
                                        label={`${field.label} for ${name}: ${value === true ? 'yes' : 'no'}. Toggle`}
                                        variant="ghost"
                                        aria-pressed={value === true}
                                        disabled={busy}
                                        onClick={() =>
                                          void run('The record was not updated', () =>
                                            host.iii.trigger(fn('toggle'), { id: record.id, field: column }),
                                          )
                                        }
                                      >
                                        {value === true ? <Check aria-hidden /> : <Circle aria-hidden />}
                                      </IconButton>
                                    </td>
                                  )
                                }
                                if (column === model.titleField && renameForm) {
                                  return <td key={column}>{renameForm}</td>
                                }
                                return (
                                  <td key={column} className={field?.type === 'number' ? 'my-worker-cell-number' : 'my-worker-cell-text'}>
                                    {value === undefined ? '' : String(value)}
                                  </td>
                                )
                              })}
                              <td className="my-worker-cell-actions">
                                <IconButton
                                  label={`Edit ${name}`}
                                  variant="ghost"
                                  onClick={() => setEditing({ id: record.id, value: String(record[model.titleField] ?? '') })}
                                >
                                  <Pencil aria-hidden />
                                </IconButton>
                                <IconButton
                                  label={`Remove ${name}`}
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => void run('The record was not removed', () => host.iii.trigger(fn('remove'), { id: record.id }))}
                                >
                                  <Trash2 aria-hidden />
                                </IconButton>
                              </td>
                            </tr>
                            {renameForm && !titleShown ? (
                              <tr>
                                <td colSpan={model.listColumns.length + 1}>{renameForm}</td>
                              </tr>
                            ) : null}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SettingsSection>
            <SettingsSection title="Endpoints" description="Derived from src/model.ts and src/actions.ts.">
              <SettingsList>
                {endpoints.map((endpoint) => (
                  <EndpointRow key={endpoint.value} {...endpoint} description={endpointNotes[endpoint.value]} />
                ))}
              </SettingsList>
            </SettingsSection>
          </div>
        </div>
      </PageMain>
    </PageShell>
  )
}

function EndpointRow({ label, value, description }: { label: string; value: string; description?: string }) {
  const { state, copy } = useCopyFlash(value)
  return (
    <SettingsRow
      label={label}
      description={description}
      control={<code className="my-worker-value">{value}</code>}
      action={
        <IconButton label={state === 'copied' ? 'Copied' : `Copy ${value}`} variant="ghost" onClick={copy}>
          {state === 'copied' ? <Check aria-hidden /> : <Copy aria-hidden />}
        </IconButton>
      }
    />
  )
}
