// A state-backed collection: one JSON array at state scope/key, written
// through one promise queue, and the my-worker::on-change event function it
// calls after every persisted write. Record rules stay in src/record.ts.
import { CallAction, type IIIClient } from 'iii-sdk'

/** The event function this worker owns: it returns the ChangeEvent it is
    called with, and every observer of it receives that event. */
export const CHANGE_FUNCTION = 'my-worker::on-change'

/** The part of the SDK client a collection needs (a test passes a fake). */
export type CollectionIii = Pick<IIIClient, 'call' | 'registerFunction'>

/** What a my-worker::on-change observer receives after a write. */
export type ChangeEvent<T> = { event: string; record: T | null; records: T[] }

/** A mutation's outcome: the new list, the record it touched, and any extra
    fields the caller returns (e.g. `removed`). */
export type Mutation<T> = { records: T[]; record?: T | null }

export type CollectionOptions<T> = {
  iii: CollectionIii
  /** State scope and key the array lives at. */
  scope: string
  key: string
  /** Turns whatever is stored into records; drop what is malformed. */
  parse: (value: unknown) => T[]
  /** The order list() returns and events carry. */
  sort: (records: readonly T[]) => T[]
  /** Event function to register and call (default my-worker::on-change). */
  changeFunction?: string
}

export type Collection<T> = {
  /** Every record, sorted. */
  list(): Promise<T[]>
  /** Read, apply `change`, persist, then emit `event`. Mutations never interleave. */
  mutate<R extends Mutation<T>>(event: string, change: (records: T[]) => R): Promise<R>
}

export function createCollection<T>({
  iii,
  scope,
  key,
  parse,
  sort,
  changeFunction = CHANGE_FUNCTION,
}: CollectionOptions<T>): Collection<T> {
  // Private: only this worker calls it; anyone may observe it. Observers pick
  // events with filters ({ 'input.event': { $in: ['created'] } }), and an
  // observer's metadata reaches its target without this worker forwarding it.
  const changes = iii.registerFunction(changeFunction, (event: ChangeEvent<T>) => event, {
    description: `Called after every persisted write to ${scope}/${key} with { event, record, records }. No args; filter on input.event.`,
    private: true,
  })

  function emit(event: ChangeEvent<T>): void {
    if (!changes.isObserved()) return
    iii
      .call({ function_id: changeFunction, payload: event, action: CallAction.Void() })
      .catch((error) => console.error('[my-worker] emit failed', error))
  }

  // The state worker lives in the project namespace: no namespace here, and
  // state::get answers with the stored value itself (null when absent).
  async function read(): Promise<T[]> {
    return parse(await iii.call<{ scope: string; key: string }, unknown>({ function_id: 'state::get', payload: { scope, key } }))
  }

  let queue: Promise<unknown> = Promise.resolve()

  return {
    async list() {
      return sort(await read())
    },

    mutate(event, change) {
      const run = async () => {
        const result = change(await read())
        await iii.call({ function_id: 'state::set', payload: { scope, key, value: result.records } })
        emit({ event, record: result.record ?? null, records: sort(result.records) })
        return result
      }
      const next = queue.then(run, run)
      queue = next.catch(() => undefined)
      return next
    },
  }
}
