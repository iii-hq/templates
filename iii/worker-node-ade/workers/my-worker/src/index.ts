import { fileURLToPath } from 'node:url'
import { CallAction, registerWorker } from 'iii-sdk'
import type { RegisterFunctionFormat } from 'iii-sdk/protocol'
import { greetee, hello, normalizeGreeting, storedGreeting, type HelloInput, type HelloOutput } from './hello.js'
import { uiContent } from './ui-assets.js'
import { WEB_PATH, webHandlers, webUrl } from './web.js'

const root = new URL('../', import.meta.url)

// Compose sets III_URL and III_NAMESPACE. Without III_URL the SDK uses
// ws://127.0.0.1:49134; it reads III_NAMESPACE itself.
const iii = registerWorker(process.env.III_URL, {
  workerName: 'my-worker',
  workerDescription: 'Example worker: greets by name, serves a public page over HTTP and an admin page in the ADE.',
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
  const { value } = await iii.call<unknown, { value: { greeting?: string } | null }>({
    function_id: 'configuration::get',
    namespace: 'default',
    payload: { id: 'my-worker' },
  })
  greeting = storedGreeting(value)
  return { greeting }
}

iii.registerFunction('my-worker::config-changed', loadConfig, {
  description: 'Reload the greeting after the my-worker configuration changes.',
  request_format: { type: 'object' },
  response_format: { type: 'object', properties: { greeting: { type: 'string' } }, required: ['greeting'] },
  metadata: { internal: true },
})
// configuration::on-updated takes no args: choose the entry and the event with filters.
iii.observe(
  {
    function_id: 'configuration::on-updated',
    filters: {
      'input.id': { $eq: 'my-worker' },
      'input.event_type': { $eq: 'configuration:updated' },
    },
  },
  'my-worker::config-changed',
)

// --- Event function: my-worker::on-hello is called after every greeting ---

const ON_HELLO = 'my-worker::on-hello'
const HELLO_EVENT: RegisterFunctionFormat = {
  type: 'object',
  properties: { name: { type: 'string' }, message: { type: 'string' } },
  required: ['name', 'message'],
}

// A private function that returns the event it is called with. Only this worker
// calls it; anyone may observe it, and an observer's metadata reaches its target
// without this worker forwarding anything.
iii.registerFunction(ON_HELLO, (event: { name: string } & HelloOutput) => event, {
  description: 'Called after every my-worker::hello with { name, message }. No args; filter on input.name.',
  request_format: HELLO_EVENT,
  response_format: HELLO_EVENT,
  private: true,
})

function emitHello(event: { name: string } & HelloOutput) {
  if (!iii.isObserved(ON_HELLO)) return
  iii
    .call({ function_id: ON_HELLO, payload: event, action: CallAction.Void() })
    .catch((error) => console.error('[my-worker] emit failed', error))
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

// --- The admin page in the ADE: where the public page lives, and the greeting ---

const WEB_URL = webUrl(process.env.III_HTTP_URL)

iii.registerFunction('my-worker::info', async () => ({ web_url: WEB_URL, web_path: WEB_PATH, greeting }), {
  description: 'Where the public page answers (web_url only when III_HTTP_URL is set), and the greeting.',
  request_format: { type: 'object' },
  response_format: {
    type: 'object',
    properties: { web_url: { type: ['string', 'null'] }, web_path: { type: 'string' }, greeting: { type: 'string' } },
    required: ['web_path', 'greeting'],
  },
  metadata: { internal: true },
})

iii.registerFunction(
  'my-worker::set-greeting',
  async ({ greeting: next }: { greeting?: string }) => {
    const value = normalizeGreeting(next)
    // configuration::* lives in the engine's `default` namespace; the
    // configuration::on-updated observer above reloads `greeting` after the write too.
    await iii.call({
      function_id: 'configuration::set',
      namespace: 'default',
      payload: { id: 'my-worker', value: { greeting: value } },
    })
    greeting = value
    return { greeting }
  },
  {
    description: 'Save the greeting the public page uses (the ADE admin page calls this).',
    request_format: {
      type: 'object',
      properties: { greeting: { type: 'string', minLength: 1, maxLength: 40 } },
      required: ['greeting'],
    },
    response_format: { type: 'object', properties: { greeting: { type: 'string' } }, required: ['greeting'] },
    metadata: { internal: true },
  },
)

// --- Admin page in the ADE: the console loads dist/ui through console::ui::asset observers ---

iii.registerFunction(
  'my-worker::ui-content',
  uiContent(fileURLToPath(new URL('dist/ui', root))),
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
iii.observe({ function_id: 'console::ui::asset', args: { kind: 'script', path: 'my-worker/page.js' } }, 'my-worker::ui-content')
iii.observe({ function_id: 'console::ui::asset', args: { kind: 'style', path: 'my-worker/styles.css' } }, 'my-worker::ui-content')

// --- Public page over HTTP (the http worker; http::status reports its address) ---

const web = webHandlers(fileURLToPath(new URL('dist/web', root)), (fn, payload) =>
  iii.call({ function_id: `my-worker::${fn}`, payload }),
)
iii.registerFunction('my-worker::http-page', web.page, {
  description: 'GET /my-worker: the public page.',
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
iii.observe({ function_id: 'http::on-request', args: { method: 'GET', path: '/my-worker' } }, 'my-worker::http-page')
iii.observe({ function_id: 'http::on-request', args: { method: 'GET', path: '/my-worker/:file' } }, 'my-worker::http-asset')
iii.observe({ function_id: 'http::on-request', args: { method: 'POST', path: '/my-worker/api/:fn' } }, 'my-worker::http-api')

// --- Configuration seed, then the first read ---

iii
  .call({
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
