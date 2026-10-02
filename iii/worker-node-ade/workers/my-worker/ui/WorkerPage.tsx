// The ADE page, built from the console's own components: @iii-dev/console-ui
// is supplied by the console at runtime, so these exist only inside the ADE.
// The standalone page served over HTTP (web/main.tsx) renders the plainer
// App instead.
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
import { type FormEvent, useCallback, useEffect, useState } from 'react'

/** my-worker::info: where the standalone page lives and the live greeting.
    web_url is absolute only when the worker has III_HTTP_URL set. */
type Info = { web_url: string | null; web_path: string; greeting: string }

/** The http worker's default port. Without web_url the page is opened on this port
    of the host the console is browsed from; set III_HTTP_URL on the worker for
    another port or host. */
const HTTP_WORKER_PORT = 3111

type Result = { kind: 'ok'; message: string; ms: number } | { kind: 'error'; message: string }

const EXPOSED = [
  {
    label: 'Function',
    value: 'my-worker::hello',
    description: 'Greets a name with the configured greeting.',
  },
  {
    label: 'Trigger type',
    value: 'my-worker:hello',
    description: 'Fires after every greeting with { name, message }.',
  },
  {
    label: 'Web page',
    value: 'GET /my-worker',
    description: 'This page outside the console, served by the http worker.',
  },
  {
    label: 'Web API',
    value: 'POST /my-worker/api/hello',
    description: 'The same call over HTTP; only hello is allowlisted.',
  },
] as const

export function WorkerPage({ host, onClose }: { host: Host; onClose?: () => void }) {
  const { ref, narrow } = useContainerNarrow()
  const [info, setInfo] = useState<Info | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const loadInfo = useCallback(() => {
    host.iii.trigger<Info>('my-worker::info', {}).then(setInfo, () => setInfo(null))
  }, [host])
  useEffect(loadInfo, [loadInfo])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    const started = performance.now()
    try {
      const { message } = await host.iii.trigger<{ message: string }>('my-worker::hello', { name })
      setResult({ kind: 'ok', message, ms: Math.round(performance.now() - started) })
      loadInfo()
    } catch (error) {
      setResult({ kind: 'error', message: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  const webHref =
    info && (info.web_url ?? `${window.location.protocol}//${window.location.hostname}:${HTTP_WORKER_PORT}${info.web_path}`)

  const openOutside = webHref ? (
    narrow ? (
      <IconButton label="Open outside console" asChild>
        <a href={webHref} target="_blank" rel="noreferrer">
          <ExternalLink aria-hidden />
        </a>
      </IconButton>
    ) : (
      <Button variant="ghost" size="sm" asChild>
        <a href={webHref} target="_blank" rel="noreferrer">
          <ExternalLink aria-hidden />
          Open outside console
        </a>
      </Button>
    )
  ) : null

  return (
    <PageShell ref={ref}>
      <PageHeader
        icon={<Wordmark className="my-worker-mark" />}
        title="my-worker"
        description="Hello-world starter"
        actions={openOutside}
        onClose={onClose}
      />
      <PageMain>
        <div className="my-worker-scroll">
          <div className="my-worker-column">
            <SettingsSection title="Say hello" description="Calls my-worker::hello through the iii engine.">
              <div className="my-worker-try">
                <form onSubmit={submit}>
                  <SettingsList>
                    <SettingsField
                      label="Name"
                      description="Leave it empty to greet World."
                      renderControl={(props) => (
                        <Input {...props} value={name} onChange={setName} placeholder="World" autoComplete="off" />
                      )}
                      action={
                        <Button type="submit" variant="primary" size="sm" disabled={busy}>
                          {busy ? 'Calling…' : 'Say hello'}
                        </Button>
                      }
                    />
                  </SettingsList>
                </form>
                {result?.kind === 'ok' ? (
                  <StatusPanel
                    role="status"
                    variant="success"
                    headline={result.message}
                    detail={`my-worker::hello answered in ${result.ms} ms`}
                  />
                ) : null}
                {result?.kind === 'error' ? (
                  <StatusPanel role="alert" variant="alert" headline="my-worker::hello failed" detail={result.message} />
                ) : null}
              </div>
            </SettingsSection>
            <SettingsSection
              title="What this worker exposes"
              description="Each one is registered in this worker’s entry file; change them there."
            >
              <SettingsList>
                {EXPOSED.map((item) => (
                  <ExposedRow key={item.label} {...item} />
                ))}
                <SettingsRow
                  label="Configuration"
                  description="Change the greeting with configuration::set on my-worker."
                  control={<code className="my-worker-value">greeting: {info ? JSON.stringify(info.greeting) : '…'}</code>}
                />
              </SettingsList>
            </SettingsSection>
          </div>
        </div>
      </PageMain>
    </PageShell>
  )
}

function ExposedRow({ label, value, description }: { label: string; value: string; description: string }) {
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
