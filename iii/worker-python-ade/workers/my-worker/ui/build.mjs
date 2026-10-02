// Two builds: the ADE page (ui/page.tsx → WorkerPage) and the standalone
// page (web/main.tsx → App):
//   1. ADE asset: page.tsx + styles.css → dist/ui. React and
//      @iii-dev/console-ui stay external (the console's import map serves
//      them); scope, token and strict design-lint checks run here.
//   2. Standalone page: web/main.tsx with React bundled → dist/web/app.js,
//      web/tokens.css + ui/styles.css → dist/web/styles.css, and a copy of
//      web/index.html.
// `--watch` keeps both rebuilding; index.html is copied once per start.
import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildWorkerUi } from '@iii-dev/console-ui/build-worker-ui'
import esbuild from 'esbuild'

const root = import.meta.dirname
const web = resolve(root, '../web')
const outdir = resolve(root, '../dist/web')
const watch = process.argv.includes('--watch')

await buildWorkerUi({ scope: 'my-worker', root, outdir: '../dist/ui', lint: { strict: true } })

mkdirSync(outdir, { recursive: true })
copyFileSync(resolve(web, 'index.html'), resolve(outdir, 'index.html'))

const shared = {
  bundle: true,
  minify: !watch,
  // A Python worker keeps node_modules in ui/, which web/ cannot reach by
  // walking up; a Node worker's root node_modules resolves without it.
  nodePaths: [resolve(root, 'node_modules')],
  logLevel: 'info',
}
for (const options of [
  { ...shared, entryPoints: [resolve(web, 'main.tsx')], outfile: resolve(outdir, 'app.js'), format: 'esm', jsx: 'automatic' },
  {
    ...shared,
    stdin: { contents: '@import "./tokens.css";\n@import "../ui/styles.css";\n', resolveDir: web, loader: 'css' },
    outfile: resolve(outdir, 'styles.css'),
  },
]) {
  if (watch) await (await esbuild.context(options)).watch()
  else await esbuild.build(options)
}
