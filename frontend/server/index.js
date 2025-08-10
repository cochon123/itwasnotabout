/* eslint-env node */
/* global process, console, setInterval, clearInterval, setTimeout */
import express from 'express'
import cors from 'cors'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const app = express()
app.use(cors())
app.use(express.json())

const BASE_PORT = Number(process.env.FRONTEND_PORT) || 5050
const projectRoot = path.resolve(process.cwd(), '..')
const backendDir = path.join(projectRoot, 'backend')
const scriptsDir = path.join(backendDir, 'scripts')
const outputDir = path.join(projectRoot, 'output')

// Simple in-memory state
const steps = [
  { id: 0, name: "Génération histoire", status: 'idle' },
  { id: 1, name: "Synthèse vocale", status: 'idle' },
  { id: 2, name: "Montage vidéo", status: 'idle' },
  { id: 3, name: "Sous-titres", status: 'idle' },
]
let running = false
const logs = [] // { ts, line }
const events = [] // { ts, kind, text, stepId?, meta? }
const MAX_LOGS = 2000
const MAX_EVENTS = 500
let currentChild = null
let paused = false

function setStepStatus(id, status) {
  const s = steps.find(x => x.id === id)
  if (s) s.status = status
}
function pushLog(line) {
  // Strip ANSI color codes without using a regex literal (avoids no-control-regex)
  const ESC = String.fromCharCode(27) // \x1b
  const ansiRe = new RegExp(`${ESC}\\[[0-9;]*m`, 'g')
  const item = { ts: Date.now(), line: String(line).replace(ansiRe, '') }
  logs.push(item)
  if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS)
}

function pushEvent(evt) {
  const item = { ts: Date.now(), kind: 'info', text: '', ...evt }
  events.push(item)
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS)
}

// SSE for logs
app.get('/sse/logs', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (event, data) => {
    res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  send('state', { steps, running })

  const interval = setInterval(() => {
    if (res.writableEnded) clearInterval(interval)
  }, 15000)

  req.on('close', () => {
    clearInterval(interval)
  })
})

// Proxy media from output folder
app.get('/media/*', (req, res) => {
  const rel = req.params[0]
  const file = path.join(outputDir, rel)
  if (!file.startsWith(outputDir)) return res.status(403).end()
  if (!fs.existsSync(file)) return res.status(404).end()
  res.sendFile(file)
})

// Logs endpoint (simple polling)
app.get('/api/logs', (req, res) => {
  const since = Number(req.query.since || 0)
  const out = logs.filter(l => l.ts > since)
  res.json({ lines: out, now: Date.now() })
})

// High-level events endpoint (simple polling)
app.get('/api/events', (req, res) => {
  const since = Number(req.query.since || 0)
  const out = events.filter(e => e.ts > since)
  res.json({ events: out, now: Date.now() })
})

// Read current env (masked)
app.get('/api/env', (_req, res) => {
  const envPath = path.join(projectRoot, '.env')
  const keys = ['GOOGLE_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY']
  const out = {}
  for (const k of keys) {
    const v = process.env[k] || readEnvValue(envPath, k)
    out[k] = v ? mask(v) : ''
  }
  res.json(out)
})

// Update env values
app.post('/api/env', (req, res) => {
  const envPath = path.join(projectRoot, '.env')
  const allowed = ['GOOGLE_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY']
  const entries = Object.entries(req.body || {}).filter(([k, v]) => allowed.includes(k) && typeof v === 'string')
  if (!entries.length) return res.status(400).json({ error: 'Rien à mettre à jour' })
  const map = Object.fromEntries(entries)
  writeEnv(envPath, map)
  // Reload in-process for next runs
  for (const [k, v] of entries) process.env[k] = v
  res.json({ ok: true })
})

function readEnvValue(envPath, key) {
  try {
    const txt = fs.readFileSync(envPath, 'utf8')
    const re = new RegExp(`^${key}=(.*)$`, 'm')
    const m = txt.match(re)
    return m ? m[1].trim() : ''
  } catch { return '' }
}
function writeEnv(envPath, updates) {
  let base = ''
  try { base = fs.readFileSync(envPath, 'utf8') } catch { base = '' }
  const lines = base.split(/\r?\n/)
  const keys = Object.keys(updates)
  const set = new Set(keys)
  const out = lines.map(line => {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
    if (!m) return line
    const k = m[1]
    if (set.has(k)) {
      const v = updates[k]
      set.delete(k)
      return `${k}=${v}`
    }
    return line
  })
  for (const k of set) out.push(`${k}=${updates[k]}`)
  fs.writeFileSync(envPath, out.join('\n'))
}
function mask(v) {
  if (!v) return ''
  if (v.length <= 6) return '*'.repeat(v.length)
  return v.slice(0, 3) + '*'.repeat(Math.max(1, v.length - 6)) + v.slice(-3)
}

// Get state
app.get('/api/state', (_req, res) => {
  res.json({ running, paused, steps, outputs: listOutputs() })
})

function listOutputs() {
  const audio = safeList(path.join(outputDir, 'audio')).map(f => `/media/audio/${f}`)
  const video = safeList(path.join(outputDir, 'video')).map(f => `/media/video/${f}`)
  return { audio, video }
}
function safeList(dir) {
  try { return fs.readdirSync(dir) } catch { return [] }
}

// Run pipeline
app.post('/api/run', async (req, res) => {
  if (running) return res.status(409).json({ error: 'Déjà en cours' })
  running = true
  paused = false
  steps.forEach(s => s.status = 'idle')

  res.json({ ok: true })

  const send = (event, data) => {
    // Broadcast to all clients by writing to a simple log file watched by client polling or SSE
    // For simplicity, we just log to console here. Clients fetch /api/state periodically.
    console.log(`[${event}]`, data)
  }

  try {
    pushEvent({ kind: 'start', text: 'Lancement du pipeline' })
    const stepStart = {}
    // Step 0 generate_story.py
    setStepStatus(0, 'running'); send('step', { id: 0, status: 'running' })
    pushEvent({ kind: 'step', stepId: 0, text: 'Génération de l’histoire — démarrée' })
    stepStart[0] = Date.now()
    await runPy(['generate_story.py'], scriptsDir)
    setStepStatus(0, 'success'); send('step', { id: 0, status: 'success' })
    pushEvent({ kind: 'success', stepId: 0, text: `Histoire générée (${Math.round((Date.now()-stepStart[0])/1000)}s)` })

    // Step 1 texttospeech.py
    setStepStatus(1, 'running'); send('step', { id: 1, status: 'running' })
    pushEvent({ kind: 'step', stepId: 1, text: 'Synthèse vocale — démarrée' })
    stepStart[1] = Date.now()
    await runPy(['texttospeech.py'], scriptsDir)
    setStepStatus(1, 'success'); send('step', { id: 1, status: 'success' })
    pushEvent({ kind: 'success', stepId: 1, text: `Voix synthétisée (${Math.round((Date.now()-stepStart[1])/1000)}s)` })

    // Step 2 montage.py
    setStepStatus(2, 'running'); send('step', { id: 2, status: 'running' })
    pushEvent({ kind: 'step', stepId: 2, text: 'Montage vidéo — en cours' })
    stepStart[2] = Date.now()
    await runPy(['montage.py'], scriptsDir)
    setStepStatus(2, 'success'); send('step', { id: 2, status: 'success' })
    pushEvent({ kind: 'success', stepId: 2, text: `Montage terminé (${Math.round((Date.now()-stepStart[2])/1000)}s)` })

    // Step 3 add_caption.py
    setStepStatus(3, 'running'); send('step', { id: 3, status: 'running' })
    pushEvent({ kind: 'step', stepId: 3, text: 'Génération des sous-titres' })
    stepStart[3] = Date.now()
    await runPy(['add_caption.py'], scriptsDir)
    setStepStatus(3, 'success'); send('step', { id: 3, status: 'success' })
    pushEvent({ kind: 'success', stepId: 3, text: `Sous-titres ajoutés (${Math.round((Date.now()-stepStart[3])/1000)}s)` })

  } catch (err) {
    console.error(err)
    // mark failing step
    const failing = steps.find(s => s.status === 'running')
    if (failing) failing.status = 'error'
    pushEvent({ kind: 'error', stepId: failing?.id, text: `Échec à l’étape “${failing?.name || 'inconnue'}”` })
  } finally {
    running = false
    paused = false
    pushEvent({ kind: 'done', text: 'Pipeline terminé' })
  }
})

app.post('/api/pause', (_req, res) => {
  if (!currentChild || paused) return res.json({ ok: false })
  try {
    process.kill(currentChild.pid, 'SIGSTOP')
    paused = true
  pushEvent({ kind: 'pause', text: 'Pipeline mis en pause' })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})
app.post('/api/resume', (_req, res) => {
  if (!currentChild || !paused) return res.json({ ok: false })
  try {
    process.kill(currentChild.pid, 'SIGCONT')
    paused = false
  pushEvent({ kind: 'resume', text: 'Pipeline repris' })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})
app.post('/api/abort', (_req, res) => {
  if (!currentChild) return res.json({ ok: false })
  try {
    currentChild.kill('SIGTERM')
  pushEvent({ kind: 'abort', text: 'Pipeline interrompu' })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

function runPy(args, cwd) {
  return new Promise((resolve, reject) => {
  // Prefer project venv if exists
  const venvPy = path.join(projectRoot, 'IWNAenv', 'bin', 'python')
  const py = process.env.PYTHON || (fs.existsSync(venvPy) ? venvPy : 'python')
  const child = spawn(py, args, { cwd })
  currentChild = child
  child.stdout.on('data', d => { process.stdout.write(d); pushLog(d.toString()) })
  child.stderr.on('data', d => { process.stderr.write(d); pushLog(d.toString()) })
  child.on('close', code => { currentChild = null; code === 0 ? resolve() : reject(new Error(`Exited ${code}`)) })
  })
}

// Start server with small auto-retry on port conflicts
let PORT = BASE_PORT
function startServer(attempt = 0) {
  const server = app.listen(PORT, () => {
    console.log(`Frontend server on http://localhost:${PORT}`)
  })
  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE' && attempt < 10) {
      console.warn(`Port ${PORT} occupé, tentative sur ${PORT + 1}…`)
      PORT += 1
      setTimeout(() => startServer(attempt + 1), 150)
    } else {
      console.error('Impossible de démarrer le serveur:', err)
      process.exit(1)
    }
  })
}
startServer()
