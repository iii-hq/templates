// Generic record logic driven by a Model (src/model.ts). Pure: no SDK import
// beyond a type, so tests run without an engine. Nothing here names a field;
// change the app in src/model.ts, not here.
import type { RegisterFunctionFormat } from 'iii-sdk/protocol'

export type FieldType = 'string' | 'number' | 'boolean'
export type Value = string | number | boolean

export type Field = {
  readonly type: FieldType
  readonly label: string
  readonly required?: boolean
  readonly default?: Value
  /** string: trimmed length; number: value. */
  readonly min?: number
  readonly max?: number
  /** string only: compared trimmed and case-insensitively. */
  readonly unique?: boolean
}

export type SortKey = { readonly field: string; readonly dir?: 'asc' | 'desc' }

export type Model = {
  /** Function ids (`my-worker::<resource>::list`) and the state key. */
  readonly resource: string
  /** Headings in the admin page. */
  readonly title: string
  /** The string field a record is shown by. */
  readonly titleField: string
  readonly fields: { readonly [name: string]: Field }
  readonly listColumns: readonly string[]
  readonly sort: readonly SortKey[]
}

/** A stored record: the model's fields plus the reserved id and timestamps (epoch ms). */
export type DataRecord = { id: string; created_at: number; updated_at: number; [field: string]: Value }

/** `total`, plus one entry per boolean field: how many records have it true. */
export type Counts = { total: number; [booleanField: string]: number }

export type Change = { record: DataRecord; records: DataRecord[] }

export const RESERVED_FIELDS: readonly string[] = ['id', 'created_at', 'updated_at']
const TYPES: readonly string[] = ['string', 'number', 'boolean']

const entries = (model: Model): [string, Field][] => Object.entries(model.fields)

/** Throws on a model the rest of this file cannot serve. Runs at startup and in a test. */
export function checkModel(model: Model): Model {
  if (!/^[a-z][a-z0-9-]*$/.test(model.resource)) throw new Error(`model.resource "${model.resource}" must be lowercase kebab-case`)
  const names = Object.keys(model.fields)
  if (names.length === 0) throw new Error('model.fields must name at least one field')
  for (const [name, field] of entries(model)) {
    if (RESERVED_FIELDS.includes(name)) throw new Error(`field "${name}" is reserved (id, created_at and updated_at are added to every record)`)
    if (name.startsWith('_')) throw new Error(`field "${name}" must not start with _`)
    if (!TYPES.includes(field.type)) throw new Error(`field "${name}" has unknown type "${String(field.type)}" (use string, number or boolean)`)
    if (field.unique && field.type !== 'string') throw new Error(`field "${name}": unique is only valid on a string field`)
    if (field.default !== undefined && typeof field.default !== field.type) throw new Error(`field "${name}": default must be a ${field.type}`)
  }
  if (!names.includes(model.titleField)) throw new Error(`model.titleField "${model.titleField}" is not a field`)
  if (model.fields[model.titleField].type !== 'string') throw new Error(`model.titleField "${model.titleField}" must be a string field`)
  for (const column of model.listColumns) {
    if (!names.includes(column)) throw new Error(`model.listColumns entry "${column}" is not a field`)
  }
  for (const key of model.sort) {
    if (!names.includes(key.field) && !RESERVED_FIELDS.includes(key.field)) throw new Error(`model.sort field "${key.field}" is not a field`)
  }
  return model
}

function normalizeValue(name: string, field: Field, raw: unknown): Value | undefined {
  const label = field.label || name
  if (field.type === 'string') {
    if (typeof raw !== 'string') throw new Error(`${label} must be text`)
    const value = raw.trim()
    if (!value) {
      if (field.required) throw new Error(`${label} is required`)
      return ''
    }
    if (field.min !== undefined && value.length < field.min) throw new Error(`${label} must be at least ${field.min} characters`)
    if (field.max !== undefined && value.length > field.max) throw new Error(`${label} must be at most ${field.max} characters`)
    return value
  }
  if (field.type === 'number') {
    const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a number`)
    if (field.min !== undefined && value < field.min) throw new Error(`${label} must be at least ${field.min}`)
    if (field.max !== undefined && value > field.max) throw new Error(`${label} must be at most ${field.max}`)
    return value
  }
  if (typeof raw !== 'boolean') throw new Error(`${label} must be true or false`)
  return raw
}

/** Checked field values from caller input. Strings are trimmed; keys that are
    unknown, reserved or start with `_` are ignored. `partial` (an update)
    checks only the fields present; otherwise defaults fill gaps and required
    fields must be there. */
export function normalizeInput(model: Model, input: unknown, { partial = false }: { partial?: boolean } = {}): Record<string, Value> {
  const source = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
  const values: Record<string, Value> = {}
  for (const [name, field] of entries(model)) {
    const raw = source[name]
    if (raw === undefined || raw === null) {
      if (partial) continue
      if (field.default !== undefined) values[name] = field.default
      else if (field.required) throw new Error(`${field.label || name} is required`)
      else if (field.type === 'string') values[name] = ''
      else if (field.type === 'boolean') values[name] = false
      continue
    }
    const value = normalizeValue(name, field, raw)
    if (value !== undefined) values[name] = value
  }
  return values
}

function checkUnique(model: Model, records: readonly DataRecord[], values: Record<string, Value>, selfId?: string): void {
  for (const [name, field] of entries(model)) {
    if (!field.unique || typeof values[name] !== 'string' || values[name] === '') continue
    const wanted = String(values[name]).trim().toLowerCase()
    const clash = records.find((record) => record.id !== selfId && typeof record[name] === 'string' && String(record[name]).trim().toLowerCase() === wanted)
    if (clash) throw new Error(`${field.label || name} must be unique: "${values[name]}" is already used`)
  }
}

function find(records: readonly DataRecord[], id: unknown): DataRecord {
  const key = typeof id === 'string' ? id.trim() : ''
  if (!key) throw new Error('id is required')
  const record = records.find((candidate) => candidate.id === key)
  if (!record) throw new Error(`record ${key} not found`)
  return record
}

export function getRecord(records: readonly DataRecord[], id: unknown): DataRecord {
  return find(records, id)
}

/** A new record; `now` (epoch ms) and `id` are passed in so tests stay deterministic. */
export function createRecord(model: Model, records: readonly DataRecord[], input: unknown, now: number, id: string): Change {
  if (records.some((record) => record.id === id)) throw new Error(`record ${id} already exists`)
  const values = normalizeInput(model, input)
  checkUnique(model, records, values)
  const record: DataRecord = { ...values, id, created_at: now, updated_at: now }
  return { record, records: [...records, record] }
}

/** Change some fields of the record with `id`; at least one field. */
export function updateRecord(model: Model, records: readonly DataRecord[], id: unknown, patch: unknown, now: number): Change {
  const current = find(records, id)
  const values = normalizeInput(model, patch, { partial: true })
  if (Object.keys(values).length === 0) throw new Error(`nothing to update: pass at least one of ${Object.keys(model.fields).join(', ')}`)
  checkUnique(model, records, values, current.id)
  const record: DataRecord = { ...current, ...values, id: current.id, created_at: current.created_at, updated_at: now }
  return { record, records: records.map((candidate) => (candidate.id === record.id ? record : candidate)) }
}

export function removeRecord(records: readonly DataRecord[], id: unknown): Change {
  const record = find(records, id)
  return { record, records: records.filter((candidate) => candidate.id !== record.id) }
}

/** The records in a stored value: malformed ones (bad reserved fields, a
    field of the wrong type, a required field missing) are dropped, unknown
    keys are left out. A non-array reads as empty. */
export function parseRecords(model: Model, value: unknown): DataRecord[] {
  if (!Array.isArray(value)) return []
  const out: DataRecord[] = []
  for (const candidate of value) {
    if (typeof candidate !== 'object' || candidate === null) continue
    const raw = candidate as Record<string, unknown>
    if (typeof raw.id !== 'string' || !raw.id) continue
    if (typeof raw.created_at !== 'number' || typeof raw.updated_at !== 'number') continue
    const record: DataRecord = { id: raw.id, created_at: raw.created_at, updated_at: raw.updated_at }
    let ok = true
    for (const [name, field] of entries(model)) {
      const v = raw[name]
      if (v === undefined) {
        if (field.required) ok = false
        continue
      }
      if (typeof v !== field.type) ok = false
      else record[name] = v as Value
    }
    if (ok) out.push(record)
  }
  return out
}

function compare(a: Value | undefined, b: Value | undefined): number {
  if (a === b) return 0
  if (a === undefined) return 1
  if (b === undefined) return -1
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b)
  return Number(a) < Number(b) ? -1 : 1
}

/** Ordered by `model.sort` (false before true, missing values last), then id; a copy. */
export function sortRecords(model: Model, records: readonly DataRecord[]): DataRecord[] {
  return [...records].sort((a, b) => {
    for (const key of model.sort) {
      const order = compare(a[key.field], b[key.field])
      if (order !== 0) return key.dir === 'desc' && a[key.field] !== undefined && b[key.field] !== undefined ? -order : order
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

export function booleanFields(model: Model): string[] {
  return entries(model)
    .filter(([, field]) => field.type === 'boolean')
    .map(([name]) => name)
}

export function countsOf(model: Model, records: readonly DataRecord[]): Counts {
  const counts: Counts = { total: records.length }
  for (const name of booleanFields(model)) counts[name] = records.filter((record) => record[name] === true).length
  return counts
}

function fieldSchema(field: Field): RegisterFunctionFormat {
  const schema: RegisterFunctionFormat = { type: field.type, description: field.label }
  if (field.type === 'string') {
    if (field.min !== undefined) schema.minLength = field.min
    if (field.max !== undefined) schema.maxLength = field.max
  }
  if (field.type === 'number') {
    if (field.min !== undefined) schema.minimum = field.min
    if (field.max !== undefined) schema.maximum = field.max
  }
  if (field.default !== undefined) schema.default = field.default
  return schema
}

function fieldProperties(model: Model): Record<string, RegisterFunctionFormat> {
  const properties: Record<string, RegisterFunctionFormat> = {}
  for (const [name, field] of entries(model)) properties[name] = fieldSchema(field)
  return properties
}

export function recordSchema(model: Model): RegisterFunctionFormat {
  return {
    type: 'object',
    properties: {
      id: { type: 'string' },
      created_at: { type: 'number', description: 'Epoch ms' },
      updated_at: { type: 'number', description: 'Epoch ms' },
      ...fieldProperties(model),
    },
    required: [...RESERVED_FIELDS, ...entries(model).filter(([, f]) => f.required).map(([name]) => name)],
  }
}

export function createSchema(model: Model): RegisterFunctionFormat {
  return {
    type: 'object',
    properties: fieldProperties(model),
    required: entries(model)
      .filter(([, f]) => f.required && f.default === undefined)
      .map(([name]) => name),
  }
}

export function updateSchema(model: Model): RegisterFunctionFormat {
  return {
    type: 'object',
    properties: { id: { type: 'string' }, ...fieldProperties(model) },
    required: ['id'],
  }
}
