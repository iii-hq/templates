// `pnpm dev`, and Compose's `run` (`node scripts/dev.mjs`): build the ADE
// assets and the public page once, keep rebuilding them on save, and restart
// the worker when src/ or dist/ui/ changes. A restart re-registers the ADE assets with new content;
// dist/web is read per request and needs none. Unlike `node --watch`, a worker
// that exits on its own ends the loop with its code, so Compose sees the crash
// and applies the container's restart policy instead of keeping it "running".
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { readdirSync, watch } from 'node:fs'
import { dirname, join } from 'node:path'

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

run(['ui/build.mjs', '--watch']).once('exit', (exitCode) => stop(exitCode || 1))

let worker
let restarting = false
function startWorker() {
  watchTree()
  worker = run(['--import', 'tsx', 'src/index.ts'])
  worker.once('exit', (exitCode) => {
    if (stopping) return
    if (!restarting) return stop(exitCode ?? 1)
    restarting = false
    startWorker()
  })
}

let pending
function restart() {
  clearTimeout(pending)
  pending = setTimeout(() => {
    if (stopping || restarting) return
    restarting = true
    const current = worker
    current.kill('SIGTERM')
    setTimeout(() => current.exitCode === null && current.signalCode === null && current.kill('SIGKILL'), 1_500)
  }, 100)
}

// One watch per directory, not `recursive: true`: on Linux a recursive watch
// follows file inodes and goes silent once a file is saved by rename, which
// is how editors and coder::update-file write. Re-armed on every start, so new
// directories and a recreated dist/ui are watched too.
let watchers = []
function watchTree() {
  for (const watcher of watchers.splice(0)) watcher.close()
  for (const root of ['src', 'dist/ui']) {
    let dirs
    try {
      dirs = [root, ...readdirSync(root, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(entry.parentPath, entry.name))]
    } catch {
      dirs = [dirname(root)] // missing: its creation restarts and re-arms
    }
    for (const dir of dirs) {
      try {
        watchers.push(watch(dir, restart).on('error', restart))
      } catch {}
    }
  }
}

startWorker()
