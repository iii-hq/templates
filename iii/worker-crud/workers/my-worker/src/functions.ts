// Generic CRUD from the model: my-worker::<resource>::list|get|create|update|remove
// and my-worker::model. Kept in the state worker at my-worker/<resource>; every
// write emits on my-worker:change (src/store.ts). No edits needed per app:
// change src/model.ts, and add domain actions in src/actions.ts.
import { randomUUID } from 'node:crypto'
import type { IIIClient } from 'iii-sdk'
import type { RegisterFunctionFormat } from 'iii-sdk/protocol'
import { PUBLIC_ACTIONS, registerActions } from './actions.js'
import { MODEL } from './model.js'
import {
  booleanFields,
  checkModel,
  countsOf,
  createRecord,
  createSchema,
  type DataRecord,
  getRecord,
  type Model,
  parseRecords,
  recordSchema,
  removeRecord,
  sortRecords,
  updateRecord,
  updateSchema,
} from './record.js'
import { type Collection, createCollection } from './store.js'

export const STATE_SCOPE = 'my-worker'

/** What src/actions.ts receives: the collection, the model, and the id helper. */
export type ActionContext = {
  collection: Collection<DataRecord>
  model: Model
  /** `toggle` -> `my-worker::<resource>::toggle`. */
  functionId(name: string): string
}

export function registerDomain(iii: IIIClient, model: Model = MODEL): ActionContext {
  checkModel(model)
  const { resource } = model
  const functionId = (name: string) => `my-worker::${resource}::${name}`
  const collection = createCollection<DataRecord>({
    iii,
    scope: STATE_SCOPE,
    key: resource,
    parse: (value) => parseRecords(model, value),
    sort: (records) => sortRecords(model, records),
  })

  const RECORD: RegisterFunctionFormat = recordSchema(model)
  const COUNTS: RegisterFunctionFormat = {
    type: 'object',
    description: 'total, plus how many records have each boolean field true',
    properties: Object.fromEntries(['total', ...booleanFields(model)].map((name) => [name, { type: 'number' }])),
    required: ['total', ...booleanFields(model)],
  }
  const EMPTY_REQUEST: RegisterFunctionFormat = { type: 'object', properties: {} }
  const ID_REQUEST: RegisterFunctionFormat = { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
  const LIST_RESPONSE: RegisterFunctionFormat = {
    type: 'object',
    properties: { records: { type: 'array', items: RECORD }, counts: COUNTS },
    required: ['records', 'counts'],
  }
  const RECORD_RESPONSE: RegisterFunctionFormat = { type: 'object', properties: { record: RECORD }, required: ['record'] }
  const CREATE_REQUEST: RegisterFunctionFormat = createSchema(model)
  const UPDATE_REQUEST: RegisterFunctionFormat = updateSchema(model)
  const MODEL_RESPONSE: RegisterFunctionFormat = {
    type: 'object',
    properties: {
      model: { type: 'object', description: 'src/model.ts as data: resource, title, titleField, fields, listColumns, sort' },
      field_order: { type: 'array', items: { type: 'string' }, description: 'Field names in model order (JSON objects may not keep key order)' },
      public_actions: { type: 'array', items: { type: 'string' }, description: 'Action names the public page may call' },
    },
    required: ['model', 'field_order', 'public_actions'],
  }

  iii.registerFunction(
    functionId('list'),
    async () => {
      const records = await collection.list()
      return { records, counts: countsOf(model, records) }
    },
    { description: `Every ${resource} record, sorted, with its counts.`, request_format: EMPTY_REQUEST, response_format: LIST_RESPONSE },
  )

  iii.registerFunction(
    functionId('get'),
    async (input: { id?: unknown }) => ({ record: getRecord(await collection.list(), input?.id) }),
    { description: `One ${resource} record by id.`, request_format: ID_REQUEST, response_format: RECORD_RESPONSE },
  )

  iii.registerFunction(
    functionId('create'),
    async (input: unknown) => {
      const { record } = await collection.mutate('created', (records) => createRecord(model, records, input, Date.now(), randomUUID()))
      return { record }
    },
    { description: `Add a ${resource} record; fields are checked against the model.`, request_format: CREATE_REQUEST, response_format: RECORD_RESPONSE },
  )

  iii.registerFunction(
    functionId('update'),
    async (input: { id?: unknown }) => {
      const { record } = await collection.mutate('updated', (records) => updateRecord(model, records, input?.id, input, Date.now()))
      return { record }
    },
    { description: `Change some fields of the ${resource} record with id.`, request_format: UPDATE_REQUEST, response_format: RECORD_RESPONSE },
  )

  iii.registerFunction(
    functionId('remove'),
    async (input: { id?: unknown }) => {
      const { record } = await collection.mutate('removed', (records) => removeRecord(records, input?.id))
      return { record }
    },
    { description: `Delete the ${resource} record with id and return it.`, request_format: ID_REQUEST, response_format: RECORD_RESPONSE },
  )

  iii.registerFunction('my-worker::model', async () => ({ model, field_order: Object.keys(model.fields), public_actions: [...PUBLIC_ACTIONS] }), {
    description: 'The model the pages render from, and the public action names.',
    request_format: EMPTY_REQUEST,
    response_format: MODEL_RESPONSE,
    metadata: { internal: true },
  })

  const ctx: ActionContext = { collection, model, functionId }
  registerActions(iii, ctx)
  return ctx
}
