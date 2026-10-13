import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MODEL } from '../src/model.js'
import { checkModel } from '../src/record.js'

describe('MODEL', () => {
  it('passes checkModel', () => {
    assert.equal(checkModel(MODEL), MODEL)
  })
})
