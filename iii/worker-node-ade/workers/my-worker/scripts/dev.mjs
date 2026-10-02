// `pnpm dev` (what Compose runs): build the ADE assets and the public page
// once, keep rebuilding them on save, and run the worker under `node --watch`
// so it restarts when src/ or dist/ui/ changes. A restart re-registers the ADE
// assets with new content; dist/web is read per request and needs none.
import { spawn } from 'node:child_process'
import { once } from 'node:events'

const children = new Set()
let stopping = false

function run(args) {
  const child = spawn(process.execPath, args, { stdio: 'inherit' })
  children.add(child)
  child.once('exit', () => children.delete(child))
  return child
}

function stop(code) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGTERM')
  setTimeout(() => {
    for (const child of children) child.kill('SIGKILL')
    process.exit(code)
  }, 1_500)
}

process.once('SIGINT', () => stop(0))
process.once('SIGTERM', () => stop(0))

const [code] = await once(run(['ui/build.mjs']), 'exit')
if (code !== 0) process.exit(code ?? 1)

for (const args of [
  ['ui/build.mjs', '--watch'],
  ['--watch-path=src', '--watch-path=dist/ui', '--watch-preserve-output', '--import', 'tsx', 'src/index.ts'],
]) {
  run(args).once('exit', (exitCode) => stop(exitCode || 1))
}
