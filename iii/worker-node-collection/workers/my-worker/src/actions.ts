// Domain actions: the per-app extension point. CRUD comes from the model
// (src/functions.ts); put anything else a record app does here, as
// my-worker::<resource>::<action>, and list the ones the public page may call
// in PUBLIC_ACTIONS (src/web.ts allowlists exactly those).
import type { IIIClient } from 'iii-sdk'
import type { RegisterFunctionFormat } from 'iii-sdk/protocol'
import type { ActionContext } from './functions.js'
import { booleanFields, recordSchema, updateRecord } from './record.js'
import type { PublicRoute } from './routes.js'

/** Action names the public page may call over HTTP (`toggle` -> my-worker::<resource>::toggle). */
export const PUBLIC_ACTIONS: readonly string[] = ['toggle']

/** Routes on their own public paths, relative to /my-worker; the plumbing
    (registerRoutes in src/routes.ts) registers each with an http trigger. The
    first segment must be static (`go/:slug`, not `:slug`); `api/...` and a
    one-segment GET (the asset route `:file`) are refused at startup, as are
    two routes that match the same URLs. A route answers with what its handler
    builds: pass records through stripPrivate (src/web.ts) to keep private
    fields out. The template ships none. Example, a
    short link that redirects (with the links::visit action below):

      export const PUBLIC_ROUTES: readonly PublicRoute<ActionContext>[] = [
        {
          method: 'GET',
          path: 'go/:slug',
          handler: async (req, { collection, model }) => {
            const slug = req.path_params?.slug ?? ''
            const link = (await collection.list()).find((r) => r.slug === slug)
            if (!link) return { status_code: 404, headers: { 'content-type': 'text/plain' }, body: 'not found' }
            await collection.mutate('updated', (records) =>
              updateRecord(model, records, link.id, { clicks: Number(link.clicks ?? 0) + 1 }, Date.now()),
            )
            return redirect(String(link.url)) // import { redirect } from './routes.js'
          },
        },
      ]
*/
export const PUBLIC_ROUTES: readonly PublicRoute<ActionContext>[] = []

export function registerActions(iii: IIIClient, { collection, model, functionId }: ActionContext): void {
  const TOGGLE_REQUEST: RegisterFunctionFormat = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      field: { type: 'string', enum: booleanFields(model), description: 'A boolean field of the model' },
    },
    required: ['id', 'field'],
  }
  const RECORD_RESPONSE: RegisterFunctionFormat = { type: 'object', properties: { record: recordSchema(model) }, required: ['record'] }

  // toggle: flip one boolean field. The pages use it for every boolean column.
  iii.registerFunction(
    functionId('toggle'),
    async (input: { id?: unknown; field?: unknown }) => {
      const field = typeof input?.field === 'string' ? input.field : ''
      if (!booleanFields(model).includes(field)) {
        throw new Error(`field must be one of the boolean fields: ${booleanFields(model).join(', ') || '(none in this model)'}`)
      }
      const { record } = await collection.mutate('updated', (records) => {
        const current = records.find((candidate) => candidate.id === input?.id)
        return updateRecord(model, records, input?.id, { [field]: current?.[field] !== true }, Date.now())
      })
      return { record }
    },
    { description: 'Flip a boolean field of the record with id.', request_format: TOGGLE_REQUEST, response_format: RECORD_RESPONSE },
  )

  // A domain action goes here. For a links model, links::visit counts a click:
  //
  //   iii.registerFunction(functionId('visit'), async ({ slug }: { slug?: string }) => {
  //     const { record } = await collection.mutate('updated', (records) => {
  //       const link = records.find((r) => r.slug === slug)
  //       return updateRecord(model, records, link?.id, { clicks: Number(link?.clicks ?? 0) + 1 }, Date.now())
  //     })
  //     return { record }
  //   }, { description: 'Count a visit and return the link.' })
  //
  // then add 'visit' to PUBLIC_ACTIONS if the public page calls it.
}
