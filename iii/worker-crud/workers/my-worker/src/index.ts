// Plumbing only. The app is src/model.ts; src/functions.ts registers CRUD
// from it, src/actions.ts the domain actions, src/store.ts the state and the
// my-worker::on-change event function, src/record.ts the generic rules.
import { fileURLToPath } from 'node:url'
import { registerWorker } from 'iii-sdk'
import type { RegisterFunctionFormat } from 'iii-sdk/protocol'
import { PUBLIC_ROUTES } from './actions.js'
import { registerDomain } from './functions.js'
import { uiContent } from './ui-assets.js'
import { registerRoutes } from './routes.js'
import { WEB_PATH, webHandlers, webUrl } from './web.js'

const root = new URL('../', import.meta.url)

// Compose sets III_URL and III_NAMESPACE. Without III_URL the SDK uses
// ws://127.0.0.1:49134; it reads III_NAMESPACE itself.
const iii = registerWorker(process.env.III_URL, {
  workerName: 'my-worker',
  workerDescription: 'Records described by src/model.ts, kept in the state worker: a live list in the ADE and a public page over HTTP.',
})

// --- The domain: my-worker::<resource>::*, my-worker::model and the my-worker::on-change event function ---

const ctx = registerDomain(iii)

// --- The admin page in the ADE: where the public page lives ---

const WEB_URL = webUrl(process.env.III_HTTP_URL)

const EMPTY_REQUEST: RegisterFunctionFormat = { type: 'object', properties: {} }
const INFO_RESPONSE: RegisterFunctionFormat = {
  type: 'object',
  properties: { web_url: { type: ['string', 'null'] }, web_path: { type: 'string' } },
  required: ['web_path'],
}
const UI_CONTENT_REQUEST: RegisterFunctionFormat = {
  type: 'object',
  properties: { path: { type: 'string' } },
  required: ['path'],
}
const UI_CONTENT_RESPONSE: RegisterFunctionFormat = {
  type: 'object',
  properties: { content: { type: 'string' }, content_type: { type: 'string' } },
  required: ['content', 'content_type'],
}

iii.registerFunction('my-worker::info', async () => ({ web_url: WEB_URL, web_path: WEB_PATH }), {
  description: 'Where the public page answers (web_url only when III_HTTP_URL is set).',
  request_format: EMPTY_REQUEST,
  response_format: INFO_RESPONSE,
  metadata: { internal: true },
})

// --- Admin page in the ADE: the console loads dist/ui through ade::ui::asset observers ---

iii.registerFunction('my-worker::ui-content', uiContent(fileURLToPath(new URL('dist/ui', root))), {
  description: 'Serve this worker’s ADE page assets.',
  request_format: UI_CONTENT_REQUEST,
  response_format: UI_CONTENT_RESPONSE,
  metadata: { internal: true },
})
iii.observe({ function_id: 'ade::ui::asset', args: { kind: 'script', path: 'my-worker/page.js' } }, 'my-worker::ui-content')
iii.observe({ function_id: 'ade::ui::asset', args: { kind: 'style', path: 'my-worker/styles.css' } }, 'my-worker::ui-content')

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

// --- Public routes from src/actions.ts (PUBLIC_ROUTES), each on /my-worker/<path> ---

registerRoutes(iii, PUBLIC_ROUTES, ctx)

const shutdown = async () => {
  await iii.shutdown()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

console.log('my-worker started')
