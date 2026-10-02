import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { greetee, hello, normalizeGreeting } from '../src/hello.js'

describe('normalizeGreeting', () => {
  it('trims a greeting', () => {
    assert.equal(normalizeGreeting('  Hi '), 'Hi')
  })

  it('refuses an empty or overlong greeting', () => {
    assert.throws(() => normalizeGreeting('   '), /must not be empty/)
    assert.throws(() => normalizeGreeting(undefined), /must not be empty/)
    assert.throws(() => normalizeGreeting('x'.repeat(41)), /at most 40/)
  })
})

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
