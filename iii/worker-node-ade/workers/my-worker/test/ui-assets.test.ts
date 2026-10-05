import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { uiContent } from '../src/ui-assets.js'

describe('ui-content', () => {
  let dir = ''

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), 'my-worker-ui-'))
    await writeFile(join(dir, 'page.js'), 'console.log("page")')
  })

  after(() => rm(dir, { recursive: true, force: true }))

  it('serves a built asset with its content type', async () => {
    assert.deepEqual(await uiContent(dir)({ path: 'my-worker/page.js' }), {
      content: 'console.log("page")',
      content_type: 'text/javascript',
    })
  })

  it('names the fix when the build is missing', async () => {
    await assert.rejects(uiContent(dir)({ path: 'my-worker/styles.css' }), /dist\/ui\/styles\.css is missing: run pnpm build in the worker folder, then restart the worker/)
    await assert.rejects(uiContent(join(dir, 'nope'))({ path: 'my-worker/page.js' }), /dist\/ui\/page\.js is missing: run pnpm build in the worker folder, then restart the worker/)
  })

  it('rejects a path outside the allowlist', async () => {
    for (const path of ['../page.js', 'constructor', '']) {
      await assert.rejects(uiContent(dir)({ path }), /Unknown UI asset/, path)
    }
  })
})
