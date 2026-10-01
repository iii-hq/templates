import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { greetee, hello } from '../src/hello.js'

describe('hello', () => {
  it('greets World with the default greeting', () => {
    assert.equal(greetee({}), 'World')
    assert.deepEqual(hello({}), { message: 'Hello, World!' })
  })

  it('greets a trimmed name with the configured greeting', () => {
    assert.equal(greetee({ name: '  Ada ' }), 'Ada')
    assert.deepEqual(hello({ name: '  Ada ' }, 'Hi'), { message: 'Hi, Ada!' })
  })
})
