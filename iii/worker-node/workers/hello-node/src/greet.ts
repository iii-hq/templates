/**
 * Pure greeting helper — no SDK dependency — importable in tests without an engine.
 */
export function buildGreeting(name: string): { message: string } {
  return { message: `Hello, ${name}!` };
}
