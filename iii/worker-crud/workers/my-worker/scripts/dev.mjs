// `pnpm dev`, and Compose's `run` (`node scripts/dev.mjs`): build the ADE
// assets and the public page, rebuild them when ui/ or web/ changes, and
// restart the worker when src/ changes or a rebuild changed dist/ui. A restart
// re-registers the ADE assets with new content; dist/web is read per request
// and needs none. Each rebuild is a one-shot `ui/build.mjs`, the same checks
// and minified production bundle as `pnpm build`, and no esbuild watcher stays
// resident; a failed rebuild logs and the loop goes on. Unlike `node --watch`,
// a worker that exits on its own ends the loop with its code, so Compose sees
// the crash and applies the container's restart policy instead of keeping it
// "running".
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { readdirSync, readFileSync, watch } from 'node:fs'
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

function debounce(fn) {
  let timer
  return () => {
    clearTimeout(timer)
    timer = setTimeout(fn, 100)
  }
}

function filesUnder(root) {
  return readdirSync(root, { recursive: true, withFileTypes: true })
}

// One watch per directory, not `recursive: true`: on Linux a recursive watch
// follows file inodes and goes silent once a file is saved by rename, which
// is how editors and coder::update-file write. Callers re-arm on every start
// or build, so new directories are watched too. Editor swap, lock and backup
// files are not saves; a rename onto the real file still reports its name.
const scratch = /^[.#]|~$|\.sw[a-p]$|^4913$|___jb_/
function watchDirs(roots, onChange) {
  const watchers = []
  for (const root of roots) {
    let dirs
    try {
      dirs = [root, ...filesUnder(root).filter((e) => e.isDirectory()).map((e) => join(e.parentPath, e.name))]
    } catch {
      dirs = [dirname(root)] // missing: its creation fires onChange, which re-arms
    }
    for (const dir of dirs) {
      try {
        const watcher = watch(dir, (_, name) => scratch.test(name ?? '') || onChange())
        watchers.push(watcher.on('error', onChange))
      } catch {}
    }
  }
  return watchers
}

function digest(dir) {
  const hash = createHash('sha256')
  try {
    const files = filesUnder(dir).filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name))
    for (const file of files.sort()) hash.update(file).update(readFileSync(file))
  } catch {}
  return hash.digest('hex')
}

let worker
let workerWatchers = []
let restarting = false
const restart = debounce(() => {
  if (stopping || restarting) return
  restarting = true
  const current = worker
  current.kill('SIGTERM')
  setTimeout(() => current.exitCode === null && current.signalCode === null && current.kill('SIGKILL'), 1_500)
})

function startWorker() {
  for (const watcher of workerWatchers.splice(0)) watcher.close()
  workerWatchers = watchDirs(['src'], restart)
  worker = run(['--import', 'tsx', 'src/index.ts'])
  worker.once('exit', (exitCode) => {
    if (stopping) return
    if (!restarting) return stop(exitCode ?? 1)
    restarting = false
    startWorker()
  })
}

// A rebuild restarts the worker only when dist/ui changed: a web/ edit, or a
// compile error that wrote nothing, leaves the worker connected.
let uiWatchers = []
let building = true // the initial build below
let again = false
function build() {
  if (stopping) return
  if (building) {
    again = true
    return
  }
  building = true
  for (const watcher of uiWatchers.splice(0)) watcher.close()
  uiWatchers = watchDirs(['ui', 'web'], rebuild)
  const before = digest('dist/ui')
  run(['ui/build.mjs']).once('exit', (exitCode) => {
    building = false
    if (stopping) return
    if (exitCode !== 0) console.error(`[dev] ui/build.mjs failed (exit ${exitCode}); the error is above`)
    if (digest('dist/ui') !== before) restart()
    if (again) {
      again = false
      build()
    }
  })
}
const rebuild = debounce(build)

uiWatchers = watchDirs(['ui', 'web'], rebuild)
const [code] = await once(run(['ui/build.mjs']), 'exit')
if (code !== 0) process.exit(code ?? 1)
building = false
startWorker()
if (again) {
  again = false
  build()
}
