// record.ts against its own test model (one field of each type plus a unique
// string), never MODEL, so these keep passing whatever src/model.ts says.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  checkModel,
  countsOf,
  createRecord,
  createSchema,
  type DataRecord,
  getRecord,
  type Model,
  normalizeInput,
  parseRecords,
  recordSchema,
  removeRecord,
  sortRecords,
  updateRecord,
  updateSchema,
} from '../src/record.js'

const TEST_MODEL = {
  resource: 'books',
  title: 'Books',
  titleField: 'name',
  fields: {
    name: { type: 'string', label: 'Name', required: true, max: 10 },
    code: { type: 'string', label: 'Code', unique: true, min: 2 },
    pages: { type: 'number', label: 'Pages', default: 0, min: 0, max: 5000 },
    read: { type: 'boolean', label: 'Read', default: false },
  },
  listColumns: ['name', 'pages', 'read'],
  sort: [{ field: 'read' }, { field: 'created_at', dir: 'desc' }],
} as const satisfies Model

const make = (patch: Partial<DataRecord> & { id: string }): DataRecord => ({
  name: 'x',
  code: '',
  pages: 0,
  read: false,
  created_at: 1,
  updated_at: 1,
  ...patch,
})

describe('checkModel', () => {
  it('accepts a valid model', () => {
    assert.equal(checkModel(TEST_MODEL), TEST_MODEL)
  })

  it('rejects each broken rule', () => {
    const broken = (patch: Partial<Model>) => () => checkModel({ ...TEST_MODEL, ...patch })
    assert.throws(broken({ fields: { ...TEST_MODEL.fields, size: { type: 'date' as 'string', label: 'Size' } } }), /unknown type/)
    assert.throws(broken({ fields: { ...TEST_MODEL.fields, id: { type: 'string', label: 'Id' } } }), /reserved/)
    assert.throws(broken({ fields: { ...TEST_MODEL.fields, created_at: { type: 'number', label: 'At' } } }), /reserved/)
    assert.throws(broken({ listColumns: ['name', 'nope'] }), /listColumns entry "nope"/)
    assert.throws(broken({ titleField: 'nope' }), /titleField "nope" is not a field/)
    assert.throws(broken({ fields: { ...TEST_MODEL.fields, pages: { type: 'number', label: 'Pages', unique: true } } }), /unique is only valid on a string/)
    assert.throws(broken({ sort: [{ field: 'nope' }] }), /sort field/)
    assert.throws(broken({ resource: 'Bad Name' }), /kebab-case/)
  })
})

describe('normalizeInput', () => {
  it('trims strings, applies defaults and ignores _-prefixed, reserved and unknown keys', () => {
    assert.deepEqual(normalizeInput(TEST_MODEL, { name: '  Dune ', _secret: 1, id: 'x', extra: true }), {
      name: 'Dune',
      code: '',
      pages: 0,
      read: false,
    })
  })

  it('parses a numeric string and checks types', () => {
    assert.equal(normalizeInput(TEST_MODEL, { name: 'a', pages: '12' }).pages, 12)
    assert.throws(() => normalizeInput(TEST_MODEL, { name: 'a', pages: 'many' }), /Pages must be a number/)
    assert.throws(() => normalizeInput(TEST_MODEL, { name: 'a', read: 'yes' }), /Read must be true or false/)
    assert.throws(() => normalizeInput(TEST_MODEL, { name: 7 }), /Name must be text/)
  })

  it('enforces required, min and max', () => {
    assert.throws(() => normalizeInput(TEST_MODEL, {}), /Name is required/)
    assert.throws(() => normalizeInput(TEST_MODEL, { name: '   ' }), /Name is required/)
    assert.throws(() => normalizeInput(TEST_MODEL, { name: 'x'.repeat(11) }), /at most 10 characters/)
    assert.throws(() => normalizeInput(TEST_MODEL, { name: 'a', code: 'z' }), /at least 2 characters/)
    assert.throws(() => normalizeInput(TEST_MODEL, { name: 'a', pages: -1 }), /Pages must be at least 0/)
    assert.throws(() => normalizeInput(TEST_MODEL, { name: 'a', pages: 5001 }), /Pages must be at most 5000/)
  })

  it('checks only the fields present when partial', () => {
    assert.deepEqual(normalizeInput(TEST_MODEL, { read: true }, { partial: true }), { read: true })
    assert.throws(() => normalizeInput(TEST_MODEL, { name: '' }, { partial: true }), /Name is required/)
  })
})

describe('createRecord', () => {
  it('adds a record with id and timestamps', () => {
    const change = createRecord(TEST_MODEL, [], { name: 'Dune', code: 'D1' }, 100, 'r1')
    assert.deepEqual(change.record, { name: 'Dune', code: 'D1', pages: 0, read: false, id: 'r1', created_at: 100, updated_at: 100 })
    assert.deepEqual(change.records, [change.record])
  })

  it('enforces unique trimmed and case-insensitively, and a fresh id', () => {
    const existing = [make({ id: 'a', code: 'AB' })]
    assert.throws(() => createRecord(TEST_MODEL, existing, { name: 'b', code: ' ab ' }, 1, 'b'), /Code must be unique/)
    assert.throws(() => createRecord(TEST_MODEL, existing, { name: 'b' }, 1, 'a'), /already exists/)
    assert.equal(createRecord(TEST_MODEL, existing, { name: 'b' }, 1, 'b').records.length, 2)
  })
})

describe('updateRecord, getRecord and removeRecord', () => {
  const records = [make({ id: 'a', code: 'AA' }), make({ id: 'b', code: 'BB' })]

  it('changes only the given fields and bumps updated_at', () => {
    const { record } = updateRecord(TEST_MODEL, records, 'a', { name: ' New ', read: true, id: 'zz' }, 50)
    assert.deepEqual(record, { ...records[0], name: 'New', read: true, updated_at: 50 })
  })

  it('allows a record to keep its own unique value but not take another', () => {
    assert.equal(updateRecord(TEST_MODEL, records, 'a', { code: 'aa' }, 2).record.code, 'aa')
    assert.throws(() => updateRecord(TEST_MODEL, records, 'a', { code: 'bb' }, 2), /must be unique/)
  })

  it('refuses an unknown id or an empty patch', () => {
    assert.throws(() => updateRecord(TEST_MODEL, records, 'zz', { read: true }, 2), /not found/)
    assert.throws(() => updateRecord(TEST_MODEL, records, 'a', { nope: 1 }, 2), /nothing to update/)
    assert.throws(() => getRecord(records, ''), /id is required/)
  })

  it('gets and removes by id', () => {
    assert.equal(getRecord(records, 'b'), records[1])
    assert.deepEqual(removeRecord(records, 'a'), { record: records[0], records: [records[1]] })
    assert.throws(() => removeRecord(records, 'zz'), /not found/)
  })
})

describe('parseRecords, sortRecords and countsOf', () => {
  it('drops malformed records and unknown keys', () => {
    const good = make({ id: 'a' })
    const stored = [good, null, 'x', { ...good, id: '' }, { ...good, id: 'b', pages: 'many' }, { id: 'c', created_at: 1, updated_at: 1 }, { ...good, id: 'd', extra: 1 }]
    assert.deepEqual(parseRecords(TEST_MODEL, stored), [good, { ...good, id: 'd' }])
    assert.deepEqual(parseRecords(TEST_MODEL, { not: 'an array' }), [])
  })

  it('sorts by the model keys without touching the input', () => {
    const input = [make({ id: 'a', read: true, created_at: 3 }), make({ id: 'b', created_at: 1 }), make({ id: 'c', created_at: 2 })]
    assert.deepEqual(sortRecords(TEST_MODEL, input).map((r) => r.id), ['c', 'b', 'a'])
    assert.deepEqual(input.map((r) => r.id), ['a', 'b', 'c'])
  })

  it('counts the total and each boolean field', () => {
    assert.deepEqual(countsOf(TEST_MODEL, [make({ id: 'a', read: true }), make({ id: 'b' })]), { total: 2, read: 1 })
    assert.deepEqual(countsOf(TEST_MODEL, []), { total: 0, read: 0 })
  })
})

describe('schemas', () => {
  it('describe the record, create and update shapes from the model', () => {
    const record = recordSchema(TEST_MODEL)
    assert.deepEqual(record.required, ['id', 'created_at', 'updated_at', 'name'])
    assert.deepEqual((record.properties as Record<string, unknown>).pages, { type: 'number', description: 'Pages', minimum: 0, maximum: 5000, default: 0 })
    assert.deepEqual(createSchema(TEST_MODEL).required, ['name'])
    assert.deepEqual((createSchema(TEST_MODEL).properties as Record<string, unknown>).name, { type: 'string', description: 'Name', maxLength: 10 })
    assert.deepEqual(updateSchema(TEST_MODEL).required, ['id'])
    assert.deepEqual(Object.keys(updateSchema(TEST_MODEL).properties ?? {}), ['id', 'name', 'code', 'pages', 'read'])
  })
})
