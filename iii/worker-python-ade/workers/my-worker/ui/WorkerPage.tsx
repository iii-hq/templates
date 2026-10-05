// The worker's admin page in the ADE, built from the console's own
// components (@iii-dev/console-ui is supplied by the console at runtime, so
// they exist only inside the ADE). People who use the worker get the public
// page instead: web/App.tsx, served over HTTP by the http worker.
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
import { useContainerNarrow, useCopyFlash } from '@iii-dev/console-ui/hooks'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { type FormEvent, type MouseEvent, useCallback, useEffect, useState } from 'react'

/** my-worker::info: where the public page lives and the live greeting.
    web_url is absolute only when the worker has III_HTTP_URL set. */
type Info = { web_url: string | null; web_path: string; greeting: string }

/** The http worker's default port. Without web_url the public page is opened
    on this port of the host the console is browsed from (a new tab) or of
    127.0.0.1 (the browser worker, which runs beside the http worker); set
    III_HTTP_URL on the worker for another port or host. */
const HTTP_WORKER_PORT = 3111

/** Opens a tab in the browser worker. When it is registered, "Open public
    page" opens there, inside the console, instead of in a new browser tab. */
const BROWSER_START = 'browser::sessions::start'

type Outcome = { kind: 'ok'; headline: string; detail?: string } | { kind: 'error'; headline: string; detail: string }

const ENDPOINTS = [
  {
    label: 'Function',
    value: 'my-worker::hello',
    description: 'Greets a name with the saved greeting.',
  },
  {
    label: 'Trigger type',
    value: 'my-worker:hello',
    description: 'Fires after every greeting with { name, message }.',
  },
  {
    label: 'Public page',
    value: 'GET /my-worker',
    description: 'What people who use this worker open, served by the http worker.',
  },
  {
    label: 'Public API',
    value: 'POST /my-worker/api/hello',
    description: 'The call the public page makes; only hello is allowlisted.',
  },
] as const

export function WorkerPage({ host, onClose }: { host: Host; onClose?: () => void }) {
  const { ref, narrow } = useContainerNarrow()
  const [info, setInfo] = useState<Info | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<Outcome | null>(null)
  const [name, setName] = useState('')
  const [calling, setCalling] = useState(false)
  const [tried, setTried] = useState<Outcome | null>(null)
  const [browser, setBrowser] = useState(false)
  const [opening, setOpening] = useState<Outcome | null>(null)

  const loadInfo = useCallback(() => {
    host.iii.trigger<Info>('my-worker::info', {}).then(setInfo, () => setInfo(null))
  }, [host])
  useEffect(loadInfo, [loadInfo])

  // engine::functions::info answers NOT_FOUND when no browser worker runs.
  useEffect(() => {
    if (!host.panels) return
    host.iii.trigger('engine::functions::info', { function_id: BROWSER_START }).then(
      () => setBrowser(true),
      () => undefined,
    )
  }, [host])

  const greeting = draft ?? info?.greeting ?? ''
  const changed = info !== null && greeting.trim() !== '' && greeting.trim() !== info.greeting

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      const next = await host.iii.trigger<{ greeting: string }>('my-worker::set-greeting', { greeting })
      setInfo((current) => (current ? { ...current, greeting: next.greeting } : current))
      setDraft(null)
      setSaved({ kind: 'ok', headline: 'Greeting saved', detail: `The public page now says “${next.greeting}, …!”` })
    } catch (error) {
      setSaved({ kind: 'error', headline: 'The greeting was not saved', detail: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  async function tryHello(event: FormEvent) {
    event.preventDefault()
    setCalling(true)
    const started = performance.now()
    try {
      const { message } = await host.iii.trigger<{ message: string }>('my-worker::hello', { name })
      setTried({ kind: 'ok', headline: message, detail: `my-worker::hello answered in ${Math.round(performance.now() - started)} ms` })
    } catch (error) {
      setTried({ kind: 'error', headline: 'my-worker::hello failed', detail: errorMessage(error) })
    } finally {
      setCalling(false)
    }
  }

  const publicHref =
    info && (info.web_url ?? `http://${window.location.hostname}:${HTTP_WORKER_PORT}${info.web_path}`)

  // Opens the public page in the browser worker's console page. Without a
  // browser worker, or on a modified click, the link opens a new browser tab as
  // usual. When the browser worker cannot start a tab, the page says so and
  // later clicks open a new tab: a window.open after the failed call would no
  // longer count as the click and the popup blocker would stop it.
  function openInBrowser(event: MouseEvent<HTMLAnchorElement>) {
    if (!browser || !info || !publicHref || event.metaKey || event.ctrlKey || event.shiftKey) return
    event.preventDefault()
    const url = info.web_url ?? `http://127.0.0.1:${HTTP_WORKER_PORT}${info.web_path}`
    host.iii.trigger<{ session_id: string }>(BROWSER_START, { url, preview: false }).then(
      ({ session_id }) => {
        setOpening(null)
        host.panels?.open({ pageId: 'browser', context: { sessionId: session_id } })
      },
      (error) => {
        setBrowser(false)
        setOpening({
          kind: 'error',
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
            <Outcome outcome={opening} />
            <SettingsSection title="Settings" description="What people see on the public page.">
              <div className="my-worker-stack">
                <form onSubmit={save}>
                  <SettingsList>
                    <SettingsField
                      label="Greeting"
                      description="Comes before the name: “Hello, Ada!”."
                      renderControl={(props) => (
                        <Input
                          {...props}
                          value={greeting}
                          onChange={setDraft}
                          placeholder={info ? 'Hello' : 'Loading…'}
                          disabled={info === null}
                          autoComplete="off"
                        />
                      )}
                      action={
                        <Button type="submit" variant="primary" size="sm" disabled={!changed || saving}>
                          {saving ? 'Saving…' : 'Save'}
                        </Button>
                      }
                    />
                  </SettingsList>
                </form>
                <Outcome outcome={saved} />
              </div>
            </SettingsSection>
            <SettingsSection title="Test" description="Calls my-worker::hello the way the public page does.">
              <div className="my-worker-stack">
                <form onSubmit={tryHello}>
                  <SettingsList>
                    <SettingsField
                      label="Name"
                      description="Leave it empty to greet World."
                      renderControl={(props) => (
                        <Input {...props} value={name} onChange={setName} placeholder="World" autoComplete="off" />
                      )}
                      action={
                        <Button type="submit" variant="ghost" size="sm" disabled={calling}>
                          {calling ? 'Calling…' : 'Say hello'}
                        </Button>
                      }
                    />
                  </SettingsList>
                </form>
                <Outcome outcome={tried} />
              </div>
            </SettingsSection>
            <SettingsSection
              title="Endpoints"
              description="Each one is registered in this worker’s entry file; change them there."
            >
              <SettingsList>
                {ENDPOINTS.map((item) => (
                  <EndpointRow key={item.label} {...item} />
                ))}
              </SettingsList>
            </SettingsSection>
          </div>
        </div>
      </PageMain>
    </PageShell>
  )
}

function Outcome({ outcome }: { outcome: Outcome | null }) {
  if (!outcome) return null
  return outcome.kind === 'ok' ? (
    <StatusPanel role="status" variant="success" headline={outcome.headline} detail={outcome.detail} />
  ) : (
    <StatusPanel role="alert" variant="alert" headline={outcome.headline} detail={outcome.detail} />
  )
}

function EndpointRow({ label, value, description }: { label: string; value: string; description: string }) {
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
