// Pure domain logic: no SDK import, so tests run without an engine.

export type HelloInput = { name?: string }
export type HelloOutput = { message: string }

/** Who `hello` greets: the trimmed name, or World. */
export function greetee(input: HelloInput): string {
  return String(input?.name ?? '').trim() || 'World'
}

/** A greeting the admin page may save: trimmed, non-empty, at most 40 characters. */
export function normalizeGreeting(input: unknown): string {
  const greeting = String(input ?? '').trim()
  if (!greeting) throw new Error('greeting must not be empty')
  if (greeting.length > 40) throw new Error('greeting must be at most 40 characters')
  return greeting
}

export function hello(input: HelloInput, greeting = 'Hello'): HelloOutput {
  return { message: `${greeting}, ${greetee(input)}!` }
}
