// The app, described. The backend (src/functions.ts), the ADE admin page and
// the tests all read this; editing it is the whole backend change.
//   resource   -> my-worker::<resource>::list|get|create|update|remove and the state key
//   fields     -> string | number | boolean, with label, required?, default?,
//                 min?, max? (string: trimmed length; number: value), unique? (string),
//                 private? (left out of the public HTTP API; admin and engine callers see it)
//   id, created_at and updated_at are added to every record and are reserved.
import type { Model } from './record.js'

export const MODEL = {
  resource: 'items',
  title: 'Items',
  titleField: 'title',
  fields: {
    title: { type: 'string', label: 'Title', required: true, max: 200 },
    done: { type: 'boolean', label: 'Done', default: false },
  },
  listColumns: ['title', 'done'],
  sort: [{ field: 'done' }, { field: 'created_at', dir: 'desc' }],
} as const satisfies Model
