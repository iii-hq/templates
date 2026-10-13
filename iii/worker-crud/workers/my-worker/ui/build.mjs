// Two builds: the admin page in the ADE (ui/page.tsx → WorkerPage) and the
// public page (web/main.tsx → App):
//   1. ADE asset: page.tsx + styles.css → dist/ui. React and
//      @iii-dev/console-ui stay external (the console's import map serves
//      them); scope, token and strict design-lint checks run here.
//   2. Public page: web/main.tsx with React bundled → dist/web/app.js,
//      web/app.css → dist/web/styles.css, and a copy of web/index.html. It is
//      not injected into the console, so it keeps its own look.
// One-shot and minified, so the public page always ships React's production
// build; a dev loop reruns it on save instead of keeping an esbuild watcher.
import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildWorkerUi } from '@iii-dev/console-ui/build-worker-ui'
import esbuild from 'esbuild'

const root = import.meta.dirname
const web = resolve(root, '../web')
const outdir = resolve(root, '../dist/web')

mkdirSync(outdir, { recursive: true })
copyFileSync(resolve(web, 'index.html'), resolve(outdir, 'index.html'))

const shared = {
  bundle: true,
  minify: true,
  // A Python worker keeps node_modules in ui/, which web/ cannot reach by
  // walking up; a Node worker's root node_modules resolves without it.
  nodePaths: [resolve(root, 'node_modules')],
  logLevel: 'info',
}
// The public page first: buildWorkerUi exits the process when a check fails,
// which would skip it. Its own failure still fails the run, at the end.
let failed = false
for (const options of [
  { ...shared, entryPoints: [resolve(web, 'main.tsx')], outfile: resolve(outdir, 'app.js'), format: 'esm', jsx: 'automatic' },
  { ...shared, entryPoints: [resolve(web, 'app.css')], outfile: resolve(outdir, 'styles.css') },
]) {
  await esbuild.build(options).catch(() => {
    failed = true
  })
}

await buildWorkerUi({ scope: 'my-worker', root, outdir: '../dist/ui', lint: { strict: true }, watch: false })
if (failed) process.exit(1)
