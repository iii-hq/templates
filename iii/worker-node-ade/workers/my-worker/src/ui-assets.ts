// The ADE page assets. Read on request, not at startup, so a start without a
// build still registers every function; only the page itself needs `pnpm build` (`pnpm start` runs it).
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Console paths the ADE loads, with the built file in dist/ui and its content type. */
const ASSETS = new Map([
  ['my-worker/page.js', { file: 'page.js', content_type: 'text/javascript' }],
  ['my-worker/styles.css', { file: 'styles.css', content_type: 'text/css' }],
])

export function uiContent(uiDir: string) {
  return async ({ path }: { path: string }) => {
    const asset = ASSETS.get(path)
    if (!asset) throw new Error(`Unknown UI asset: ${path}`)
    try {
      return { content: await readFile(join(uiDir, asset.file), 'utf8'), content_type: asset.content_type }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error(`dist/ui/${asset.file} is missing: run pnpm build in the worker folder, then restart the worker`)
      throw error
    }
  }
}
