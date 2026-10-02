import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { registerWorker, TriggerAction } from 'iii-sdk'
import type { RegisterFunctionFormat } from 'iii-sdk/protocol'
import type { TriggerConfig } from 'iii-sdk/trigger'
import { greetee, hello, type HelloInput, type HelloOutput } from './hello.js'
import { webHandlers, webUrl } from './web.js'

const root = new URL('../', import.meta.url)

// Compose sets III_URL and III_NAMESPACE. Without III_URL the SDK uses
// ws://127.0.0.1:49134; it reads III_NAMESPACE itself.
const iii = registerWorker(process.env.III_URL, {
  workerName: 'my-worker',
  workerDescription: 'Example worker: greets by name, shows a console page in the ADE and a plainer page over HTTP.',
})

// --- Configuration: one greeting, seeded once, reloaded on every update ---

const CONFIG_SCHEMA = {
  type: 'object',
  properties: { greeting: { type: 'string', minLength: 1 } },
  required: ['greeting'],
}
let greeting = 'Hello'

async function loadConfig() {
  // configuration::* lives in the engine's `default` namespace.
  const { value } = await iii.trigger<unknown, { value: { greeting?: string } | null }>({
    function_id: 'configuration::get',
    namespace: 'default',
    payload: { id: 'my-worker' },
  })
  greeting = value?.greeting || 'Hello'
  return { greeting }
}

iii.registerFunction('my-worker::config-changed', loadConfig, {
  description: 'Reload the greeting after the my-worker configuration changes.',
  request_format: { type: 'object' },
  response_format: { type: 'object', properties: { greeting: { type: 'string' } }, required: ['greeting'] },
  metadata: { internal: true },
})
iii.registerTrigger({
  type: 'configuration',
  function_id: 'my-worker::config-changed',
  config: { configuration_id: 'my-worker', event_types: ['configuration:updated'] },
})

// --- Own trigger type: my-worker:hello fires after every greeting ---

type HelloTriggerConfig = { metadata?: Record<string, unknown> }
const subscribers = new Map<string, TriggerConfig<HelloTriggerConfig>>()

iii.registerTriggerType<HelloTriggerConfig>(
  {
    id: 'my-worker:hello',
    description:
      'Fires after every my-worker::hello call with { name, message }. Config: { metadata? } — metadata rides along to the invoked handler.',
  },
  {
    registerTrigger: async (binding) => {
      subscribers.set(binding.id, binding)
    },
    unregisterTrigger: async (binding) => {
      subscribers.delete(binding.id)
    },
  },
)

function emitHello(event: { name: string } & HelloOutput) {
  for (const binding of subscribers.values()) {
    const metadata = binding.config?.metadata ?? binding.metadata
    iii
      .trigger({
        function_id: binding.function_id,
        namespace: binding.namespace,
        payload: event,
        ...(metadata === undefined ? {} : { metadata }),
        action: TriggerAction.Void(),
      })
      .catch(() => undefined)
  }
}

// --- Functions ---

const HELLO_REQUEST: RegisterFunctionFormat = {
  type: 'object',
  properties: { name: { type: 'string', description: 'Who to greet; defaults to World' } },
}
const HELLO_RESPONSE: RegisterFunctionFormat = {
  type: 'object',
  properties: { message: { type: 'string' } },
  required: ['message'],
}

iii.registerFunction(
  'my-worker::hello',
  async (input: HelloInput) => {
    const output = hello(input, greeting)
    emitHello({ name: greetee(input), ...output })
    return output
  },
  { description: 'Greet `name` (default World) with the configured greeting.', request_format: HELLO_REQUEST, response_format: HELLO_RESPONSE },
)

// --- What the ADE page shows: the standalone page URL and the live greeting ---

const WEB_URL = webUrl(process.env.III_HTTP_URL)

iii.registerFunction('my-worker::info', async () => ({ web_url: WEB_URL, greeting }), {
  description: 'Where the standalone page answers, and the configured greeting.',
  request_format: { type: 'object' },
  response_format: {
    type: 'object',
    properties: { web_url: { type: 'string' }, greeting: { type: 'string' } },
    required: ['web_url', 'greeting'],
  },
  metadata: { internal: true },
})

// --- ADE page: the console loads dist/ui through console:script/console:style ---

const uiAssets = new Map([
  ['my-worker/page.js', { content: await readFile(new URL('dist/ui/page.js', root), 'utf8'), content_type: 'text/javascript' }],
  ['my-worker/styles.css', { content: await readFile(new URL('dist/ui/styles.css', root), 'utf8'), content_type: 'text/css' }],
])

iii.registerFunction(
  'my-worker::ui-content',
  async ({ path }: { path: string }) => {
    const asset = uiAssets.get(path)
    if (!asset) throw new Error(`Unknown UI asset: ${path}`)
    return asset
  },
  {
    description: 'Serve this worker’s ADE page assets.',
    request_format: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    response_format: {
      type: 'object',
      properties: { content: { type: 'string' }, content_type: { type: 'string' } },
      required: ['content', 'content_type'],
    },
    metadata: { internal: true },
  },
)
iii.registerTrigger({ type: 'console:script', function_id: 'my-worker::ui-content', config: { path: 'my-worker/page.js' } })
iii.registerTrigger({ type: 'console:style', function_id: 'my-worker::ui-content', config: { path: 'my-worker/styles.css' } })

// --- Standalone page over HTTP (http worker, 127.0.0.1:3111) ---

const web = webHandlers(fileURLToPath(new URL('dist/web', root)), (fn, payload) =>
  iii.trigger({ function_id: `my-worker::${fn}`, payload }),
)
iii.registerFunction('my-worker::http-page', web.page, {
  description: 'GET /my-worker: the standalone page.',
  metadata: { internal: true },
})
iii.registerFunction('my-worker::http-asset', web.asset, {
  description: 'GET /my-worker/:file: the page script or stylesheet.',
  metadata: { internal: true },
})
iii.registerFunction('my-worker::http-api', web.api, {
  description: 'POST /my-worker/api/:fn: call an allowlisted my-worker function.',
  metadata: { internal: true },
})
iii.registerTrigger({ type: 'http', function_id: 'my-worker::http-page', config: { api_path: '/my-worker', http_method: 'GET' } })
iii.registerTrigger({ type: 'http', function_id: 'my-worker::http-asset', config: { api_path: '/my-worker/:file', http_method: 'GET' } })
iii.registerTrigger({ type: 'http', function_id: 'my-worker::http-api', config: { api_path: '/my-worker/api/:fn', http_method: 'POST' } })

// --- Configuration seed, then the first read ---

iii
  .trigger({
    function_id: 'configuration::ensure',
    namespace: 'default',
    payload: {
      id: 'my-worker',
      name: 'my-worker',
      description: 'Greeting used by my-worker::hello.',
      schema: CONFIG_SCHEMA,
      initial_value: { greeting: 'Hello' },
    },
  })
  .then(loadConfig)
  .catch((error) => console.error(`[my-worker] configuration unavailable, greeting with "${greeting}":`, error))

const shutdown = async () => {
  await iii.shutdown()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

console.log('my-worker started')
