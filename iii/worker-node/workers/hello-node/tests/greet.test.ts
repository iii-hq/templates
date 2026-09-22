import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildGreeting } from '../src/greet.js';

describe('buildGreeting', () => {
  it('returns a greeting for "World"', () => {
    const result = buildGreeting('World');
    assert.deepStrictEqual(result, { message: 'Hello, World!' });
  });

  it('returns a greeting for a custom name', () => {
    const result = buildGreeting('Alice');
    assert.deepStrictEqual(result, { message: 'Hello, Alice!' });
  });
});
