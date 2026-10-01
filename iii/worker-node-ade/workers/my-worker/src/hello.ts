// Pure domain logic: no SDK import, so tests run without an engine.

export type HelloInput = { name?: string }
export type HelloOutput = { message: string }

/** Who `hello` greets: the trimmed name, or World. */
export function greetee(input: HelloInput): string {
  return String(input?.name ?? '').trim() || 'World'
}

export function hello(input: HelloInput, greeting = 'Hello'): HelloOutput {
  return { message: `${greeting}, ${greetee(input)}!` }
}
