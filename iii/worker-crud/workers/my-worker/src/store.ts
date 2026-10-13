// A state-backed collection: one JSON array at state scope/key, written
// through one promise queue, and the my-worker:change trigger type that fires
// after every persisted write. Record rules stay in src/record.ts.
import { type IIIClient, TriggerAction } from 'iii-sdk'
import type { TriggerConfig } from 'iii-sdk/trigger'

/** The trigger type this worker owns; a binding receives a ChangeEvent. */
export const CHANGE_TRIGGER = 'my-worker:change'

/** The part of the SDK client a collection needs (a test passes a fake). */
export type CollectionIii = Pick<IIIClient, 'trigger' | 'registerTriggerType'>

/** What a my-worker:change binding receives after a write. */
export type ChangeEvent<T> = { event: string; record: T | null; records: T[] }

/** A binding's config: only some events, and metadata for the handler. */
export type ChangeConfig = { events?: string[]; metadata?: Record<string, unknown> }

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
  /** Trigger type to register and emit on (default my-worker:change). */
  triggerType?: string
}

export type Collection<T> = {
  /** Every record, sorted. */
  list(): Promise<T[]>
  /** Read, apply `change`, persist, then emit `event`. Mutations never interleave. */
  mutate<R extends Mutation<T>>(event: string, change: (records: T[]) => R): Promise<R>
}

/** The metadata a handler receives: the binding's own, with the config's
    `metadata` laid over it (config first on every shared key). Merged, not
    replaced: a session wake routes on its binding metadata, so dropping it
    would lose the delivery. */
export function metadataFor(binding: { config?: ChangeConfig | null; metadata?: unknown }): Record<string, unknown> | undefined {
  const own = isRecord(binding.metadata) ? binding.metadata : undefined
  const fromConfig = isRecord(binding.config?.metadata) ? binding.config.metadata : undefined
  if (!own && !fromConfig) return undefined
  return { ...own, ...fromConfig }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function createCollection<T>({
  iii,
  scope,
  key,
  parse,
  sort,
  triggerType = CHANGE_TRIGGER,
}: CollectionOptions<T>): Collection<T> {
  const subscribers = new Map<string, TriggerConfig<ChangeConfig>>()

  iii.registerTriggerType<ChangeConfig>(
    {
      id: triggerType,
      description: `Fires after every persisted write to ${scope}/${key} with { event, record, records }. Config: { events?: string[], metadata? } — metadata rides along to the invoked handler.`,
    },
    {
      registerTrigger: async (binding) => {
        subscribers.set(binding.id, binding)
      },
      unregisterTrigger: async (binding) => {
        subscribers.delete(binding.id)
      },
    },
  )

  function emit(event: ChangeEvent<T>): void {
    for (const binding of subscribers.values()) {
      const wanted = binding.config?.events
      if (wanted && !wanted.includes(event.event)) continue
      const metadata = metadataFor(binding)
      iii
        .trigger({
          function_id: binding.function_id,
          namespace: binding.namespace,
          payload: event,
          ...(metadata === undefined ? {} : { metadata }),
          action: TriggerAction.Void(),
        })
        .catch(() => undefined)
    }
  }

  // The state worker lives in the project namespace: no namespace here, and
  // state::get answers with the stored value itself (null when absent).
  async function read(): Promise<T[]> {
    return parse(await iii.trigger<{ scope: string; key: string }, unknown>({ function_id: 'state::get', payload: { scope, key } }))
  }

  let queue: Promise<unknown> = Promise.resolve()

  return {
    async list() {
      return sort(await read())
    },

    mutate(event, change) {
      const run = async () => {
        const result = change(await read())
        await iii.trigger({ function_id: 'state::set', payload: { scope, key, value: result.records } })
        emit({ event, record: result.record ?? null, records: sort(result.records) })
        return result
      }
      const next = queue.then(run, run)
      queue = next.catch(() => undefined)
      return next
    },
  }
}
