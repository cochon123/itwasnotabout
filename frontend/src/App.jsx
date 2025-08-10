import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Orb3D from './components/Orb3D'

const StepDot = ({ status }) => {
  const color = status === 'success' ? 'bg-success' : status === 'running' ? 'bg-running animate-pulse' : status === 'error' ? 'bg-error' : 'bg-pending'
  return <div className={`w-3 h-3 rounded-full ${color}`}></div>
}

function useStatePolling() {
  const [state, setState] = useState({ running: false, steps: [], outputs: { audio: [], video: [] } })
  useEffect(() => {
    let t
    async function fetchState() {
      try {
        const res = await fetch('/api/state')
        const json = await res.json()
        setState(json)
      } catch {}
      t = setTimeout(fetchState, 1200)
    }
    fetchState()
    return () => clearTimeout(t)
  }, [])
  return state
}

function useEvents() {
  const [since, setSince] = useState(0)
  const [events, setEvents] = useState([])
  useEffect(() => {
    let stop = false
    async function pull() {
      try {
        const res = await fetch('/api/events?since=' + since)
        const json = await res.json()
        if (!stop) {
          if (Array.isArray(json.events)) setEvents(prev => [...prev, ...json.events])
          setSince(json.now)
        }
      } catch {}
      if (!stop) setTimeout(pull, 900)
    }
    pull()
    return () => { stop = true }
  }, [])
  return events
}

const OrbButton = ({ onClick, running }) => {
  return (
    <div className="relative w-64 h-64 mx-auto my-10">
      <div className={`absolute inset-0 rounded-full blur-2xl bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-500 opacity-60 ${running ? 'animate-ping' : ''}`}></div>
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-fuchsia-600 to-indigo-600 shadow-2xl flex items-center justify-center cursor-pointer select-none"
           onClick={onClick}
           title="Imprimer de l'argent">
        <span className="text-5xl">💸</span>
      </div>
      <div className="absolute inset-0 rounded-full pointer-events-none" style={{
        background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3), transparent 60%)'
      }}></div>
    </div>
  )
}

export default function App() {
  const { running, steps, outputs } = useStatePolling()
  const events = useEvents()
  const [kick, setKick] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [envVals, setEnvVals] = useState({ GOOGLE_API_KEY: '', GEMINI_API_KEY: '', OPENAI_API_KEY: '' })

  const start = async () => {
    await fetch('/api/run', { method: 'POST' })
    setKick(x => x + 1)
  }

  const latestVideo = useMemo(() => outputs.video.slice().reverse()[0], [outputs])
  const latestAudio = useMemo(() => outputs.audio.slice().reverse()[0], [outputs])
  const [logSince, setLogSince] = useState(0)
  const [lines, setLines] = useState([])
  const termRef = useRef(null)

  useEffect(() => {
    let stop = false
    async function pull() {
      try {
        const res = await fetch('/api/logs?since=' + logSince)
        const json = await res.json()
        if (!stop) {
          setLines(prev => [...prev, ...json.lines])
          setLogSince(json.now)
        }
      } catch {}
      if (!stop) setTimeout(pull, 1200)
    }
    pull()
    return () => { stop = true }
  }, [])

  // Auto-scroll terminal
  useEffect(() => {
    const el = termRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [lines])

  return (
    <div className="h-screen overflow-hidden flex flex-col text-white bg-gradient-to-b from-gray-950 to-gray-900">
      <header className="flex items-center justify-between p-4">
        <h1 className="font-bold text-xl">It Was Not About</h1>
        <div className="flex items-center gap-4">
          <div className="text-sm opacity-80">{steps.find(s => s.status === 'running')?.name || (running ? 'En cours...' : 'Prêt')}</div>
          <button className="px-3 py-1 rounded border border-gray-700 hover:bg-gray-800" onClick={async () => {
            const res = await fetch('/api/env')
            const json = await res.json()
            setEnvVals(json)
            setShowSettings(true)
          }}>Paramètres</button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 grid grid-cols-1 md:grid-cols-[1fr_420px] gap-6 items-start overflow-hidden pb-4">
        {/* Colonne gauche: Orbe + étapes + médias compacts */}
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex-1 flex items-center justify-center min-h-[320px]">
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, type: 'spring', stiffness: 100, damping: 16 }}
              >
                <Orb3D onClick={start} running={running} />
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex gap-3 items-center justify-center mb-3 px-2">
            {steps.map(s => (
              <motion.div key={s.id} initial={{ scale: 0.9, opacity: 0.6 }} animate={{ scale: s.status==='running'?1.15:1, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 14 }} className="flex items-center gap-2">
                <StepDot status={s.status} />
                <span className="text-xs text-gray-400 hidden sm:block">{s.name}</span>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[260px]">
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-3 overflow-hidden">
              <h2 className="font-semibold mb-2 text-sm">Aperçu vidéo</h2>
              {latestVideo ? (
                <video src={latestVideo} controls className="w-full h-[200px] object-cover rounded" />
              ) : (
                <div className="text-xs text-gray-400">La vidéo apparaîtra après le rendu.</div>
              )}
            </div>
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-3 overflow-hidden">
              <h2 className="font-semibold mb-2 text-sm">Aperçu audio</h2>
              {latestAudio ? (
                <audio src={latestAudio} controls className="w-full" />
              ) : (
                <div className="text-xs text-gray-400">L’audio apparaîtra après la synthèse.</div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 gap-3">
            <div className="flex gap-2">
              <button disabled={!running} onClick={async () => { await fetch('/api/pause', { method: 'POST' }) }} className="px-3 py-1.5 rounded border border-gray-700 hover:bg-gray-800 disabled:opacity-40 text-sm">Pause</button>
              <button disabled={!running} onClick={async () => { await fetch('/api/resume', { method: 'POST' }) }} className="px-3 py-1.5 rounded border border-gray-700 hover:bg-gray-800 disabled:opacity-40 text-sm">Reprendre</button>
              <button disabled={!running} onClick={async () => { await fetch('/api/abort', { method: 'POST' }) }} className="px-3 py-1.5 rounded border border-red-700 text-red-300 hover:bg-red-950/50 disabled:opacity-40 text-sm">Stop</button>
            </div>
            {latestVideo && (
              <a href={latestVideo} download className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-sm">Télécharger la vidéo</a>
            )}
          </div>
        </div>

        {/* Colonne droite: Fil d’événements stylé + terminal réduit */}
        <div className="h-full overflow-hidden flex flex-col">
          <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 flex-1 overflow-auto">
            <h2 className="font-semibold mb-3">Ce qui se passe</h2>
            <ul className="space-y-2">
              {events.slice(-80).map((e, i) => (
                <li key={e.ts + '-' + i} className="flex items-start gap-3">
                  <span className={`mt-1 w-2 h-2 rounded-full ${
                    e.kind==='error' ? 'bg-error' : e.kind==='success' ? 'bg-success' : e.kind==='step' || e.kind==='start' ? 'bg-running' : 'bg-pending'
                  }`}></span>
                  <div>
                    <div className="text-sm">{e.text}</div>
                    <div className="text-[10px] text-gray-500">{new Date(e.ts).toLocaleTimeString()}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div ref={termRef} className="bg-black/60 border border-gray-800 rounded-lg p-3 mt-3 h-[160px] overflow-auto font-mono text-[11px]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Détails techniques</h3>
              <span className="text-[10px] text-gray-500">/api/logs</span>
            </div>
            <div className="space-y-0.5">
              {lines.slice(-120).map((l, i) => (
                <div key={l.ts + '-' + i} className="whitespace-pre text-gray-300">{l.line}</div>
              ))}
            </div>
          </div>
        </div>
      </main>

  <footer className="p-2 text-center text-[11px] text-gray-500">Frontend expérimental.</footer>

      {showSettings && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-lg">
            <h3 className="font-semibold mb-4">Clés API</h3>
            <div className="space-y-3">
              {['GOOGLE_API_KEY','GEMINI_API_KEY','OPENAI_API_KEY'].map(k => (
                <div key={k}>
                  <label className="block text-sm text-gray-400 mb-1">{k}</label>
                  <input className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700" type="text" value={envVals[k]||''} onChange={e => setEnvVals(v => ({...v,[k]:e.target.value}))} />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowSettings(false)} className="px-3 py-1 rounded border border-gray-700">Annuler</button>
              <button onClick={async () => {
                await fetch('/api/env', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(envVals) })
                setShowSettings(false)
              }} className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
