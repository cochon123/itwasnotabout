import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import SiriOrb3D from './components/SiriOrb3D'

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
    // Fetch state immediately on mount and then poll
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
          // On initial load, replace events instead of appending
          if (since === 0) {
            setEvents(json.events || [])
          } else {
            // On subsequent polls, append new events
            if (Array.isArray(json.events)) setEvents(prev => [...prev, ...json.events])
          }
          setSince(json.now)
        }
      } catch {}
      if (!stop) setTimeout(pull, 900)
    }
    // Fetch events immediately on mount and then poll
    pull()
    return () => { stop = true }
  }, [])
  return events
}



export default function App() {
  const { running, steps, outputs } = useStatePolling()
  const events = useEvents()
  const [kick, setKick] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [envVals, setEnvVals] = useState({ GOOGLE_API_KEY: '', GEMINI_API_KEY: '', OPENAI_API_KEY: '' })
  const [viewMode, setViewMode] = useState(() => {
    // Initialize from localStorage or default to 'detailed'
    return localStorage.getItem('viewMode') || 'detailed'
  })

  // Save viewMode to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('viewMode', viewMode)
  }, [viewMode])

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
          // On initial load, replace lines instead of appending
          if (logSince === 0) {
            setLines(json.lines || [])
          } else {
            // On subsequent polls, append new lines
            setLines(prev => [...prev, ...json.lines])
          }
          setLogSince(json.now)
        }
      } catch {}
      if (!stop) setTimeout(pull, 1200)
    }
    // Fetch logs immediately on mount and then poll
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
    <div className="h-screen overflow-hidden flex flex-col text-[var(--text-primary)] bg-[var(--bg-primary)]">
      <header className="flex items-center justify-between p-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <h1 className="font-bold text-xl bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">It Was Not About</h1>
        <div className="flex items-center gap-4">
          <div className="text-sm px-3 py-1 rounded-full bg-[var(--bg-primary)] border border-[var(--border-color)]">
            {steps.find(s => s.status === 'running')?.name || (running ? 'En cours...' : 'Prêt')}
          </div>
          <button className="px-3 py-1 rounded border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] active:bg-[var(--bg-primary)] transition-colors" onClick={async () => {
            const res = await fetch('/api/env')
            const json = await res.json()
            setEnvVals(json)
            setShowSettings(true)
          }}>Paramètres</button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel - Process and Media */}
        <div className="flex-1 flex flex-col overflow-hidden p-4 gap-6">
          {/* Central Orb Area with Media Previews */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="flex flex-col items-center">
              <div className="relative">
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, type: 'spring', stiffness: 100, damping: 16 }}
                  >
                    <SiriOrb3D onClick={start} running={running} />
                  </motion.div>
                </AnimatePresence>
                
                {/* Status indicator */}
                <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-[var(--bg-secondary)] px-4 py-2 rounded-full border border-[var(--border-color)] shadow-lg">
                  <div className={`w-3 h-3 rounded-full ${running ? 'bg-running animate-pulse' : 'bg-success'}`}></div>
                  <span className="text-sm">{running ? 'Génération en cours...' : 'Prêt à créer'}</span>
                </div>
              </div>
            </div>
            
            {/* Media Preview Section - Now beside the orb */}
            <div className="flex flex-col md:flex-row gap-4 w-full max-w-2xl">
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm flex-1 flex flex-col">
                <h2 className="font-semibold mb-3">Aperçu vidéo</h2>
                <div className="flex-1 flex items-center justify-center min-h-[200px]">
                  {latestVideo ? (
                    <video src={latestVideo} controls className="w-full h-full object-contain rounded-lg max-h-[200px]" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[var(--bg-primary)] rounded-lg border-2 border-dashed border-[var(--border-color)]">
                      <div className="text-center text-[var(--text-secondary)]">
                        <div className="text-4xl mb-2">📹</div>
                        <p className="text-sm">La vidéo apparaîtra après le rendu</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm flex-1 flex flex-col">
                <h2 className="font-semibold mb-3">Aperçu audio</h2>
                <div className="flex-1 flex items-center justify-center min-h-[200px]">
                  {latestAudio ? (
                    <div className="w-full flex items-center">
                      <audio src={latestAudio} controls className="w-full" />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[var(--bg-primary)] rounded-lg border-2 border-dashed border-[var(--border-color)]">
                      <div className="text-center text-[var(--text-secondary)]">
                        <div className="text-4xl mb-2">🔊</div>
                        <p className="text-sm">L'audio apparaîtra après la synthèse</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Process Steps - Full Width */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Processus de génération</h2>
              <div className="text-sm text-[var(--text-secondary)]">
                {steps.filter(s => s.status === 'success').length}/{steps.length} étapes terminées
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {steps.map((s, index) => (
                <motion.div 
                  key={s.id} 
                  initial={{ scale: 0.9, opacity: 0.6 }} 
                  animate={{ scale: s.status==='running'?1.05:1, opacity: 1 }} 
                  transition={{ type: 'spring', stiffness: 220, damping: 14 }} 
                  className="flex flex-col items-center gap-3 p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]"
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg ${
                    s.status === 'success' ? 'bg-success text-white' : 
                    s.status === 'running' ? 'bg-running text-white animate-pulse' : 
                    s.status === 'error' ? 'bg-error text-white' : 'bg-pending text-[var(--text-secondary)]'
                  }`}>
                    {s.status === 'success' ? '✓' : 
                     s.status === 'running' ? '●' : 
                     s.status === 'error' ? '✗' : index + 1}
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-sm">{s.name}</div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1">
                      {s.status === 'success' ? 'Terminé' : 
                       s.status === 'running' ? 'En cours...' : 
                       s.status === 'error' ? 'Erreur' : 'En attente'}
                    </div>
                  </div>
                  {/* Step action button */}
                  <button 
                    disabled={running || s.status === 'running' || s.status === 'success'}
                    onClick={async () => {
                      try {
                        const response = await fetch(`/api/run-step/${s.id}`, { method: 'POST' })
                        const result = await response.json()
                        if (!response.ok) {
                          console.error('Failed to execute step:', result.error)
                        }
                      } catch (err) {
                        console.error('Error executing step:', err)
                      }
                    }}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      running || s.status === 'running' || s.status === 'success'
                        ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white'
                    }`}
                  >
                    {s.status === 'success' ? 'Terminé' : 'Exécuter'}
                  </button>
                </motion.div>
              ))}
            </div>
          </div>

          
        </div>

        {/* Right Panel - Activity, Logs and Controls */}
        <div className="w-96 border-l border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col overflow-hidden">
          <div className="p-3 border-b border-[var(--border-color)] flex justify-between items-center">
            <h2 className="font-semibold">Activité du système</h2>
            <div className="flex gap-1 bg-[var(--bg-primary)] rounded-lg p-1">
              <button 
                onClick={() => setViewMode('simple')}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  viewMode === 'simple' 
                    ? 'bg-indigo-600 text-white' 
                    : 'hover:bg-[var(--bg-secondary)] active:bg-[var(--bg-primary)]'
                }`}
              >
                Simple
              </button>
              <button 
                onClick={() => setViewMode('detailed')}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  viewMode === 'detailed' 
                    ? 'bg-indigo-600 text-white' 
                    : 'hover:bg-[var(--bg-secondary)] active:bg-[var(--bg-primary)]'
                }`}
              >
                Détaillé
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden flex flex-col">
            {viewMode === 'simple' ? (
              // Simple view - User-friendly progress
              <div className="flex-1 overflow-auto p-3">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">Progression</h3>
                    <div className="space-y-3">
                      {steps.map((step, index) => (
                        <div key={step.id} className="bg-[var(--bg-primary)] rounded-lg p-3 border border-[var(--border-color)]">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-3 h-3 rounded-full ${
                              step.status === 'success' ? 'bg-success' : 
                              step.status === 'running' ? 'bg-running animate-pulse' : 
                              step.status === 'error' ? 'bg-error' : 'bg-pending'
                            }`}></div>
                            <span className="text-sm font-medium">{step.name}</span>
                          </div>
                          <div className="text-xs text-[var(--text-secondary)] mt-1">
                            {step.status === 'success' ? 'Terminé avec succès' : 
                             step.status === 'running' ? 'En cours de traitement...' : 
                             step.status === 'error' ? 'Erreur survenue' : 'En attente'}
                          </div>
                          {step.status === 'running' && (
                            <div className="mt-2 w-full bg-[var(--bg-primary)] rounded-full h-1.5">
                              <div className="bg-indigo-600 h-1.5 rounded-full animate-pulse" style={{width: '60%'}}></div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-2">Activité récente</h3>
                    <div className="space-y-2">
                      {events.slice(-5).map((e, i) => (
                        <div key={e.ts + '-' + i} className="bg-[var(--bg-primary)] rounded-lg p-2 border border-[var(--border-color)]">
                          <div className="flex items-start gap-2">
                            <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                              e.kind==='error' ? 'bg-error' : 
                              e.kind==='success' ? 'bg-success' : 
                              e.kind==='step' || e.kind==='start' ? 'bg-running' : 'bg-pending'
                            }`}></span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm break-words">{e.text}</div>
                              <div className="text-[10px] text-[var(--text-secondary)] mt-1">{new Date(e.ts).toLocaleTimeString()}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-2">Statut</h3>
                    <div className="bg-[var(--bg-primary)] rounded-lg p-3 border border-[var(--border-color)]">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${running ? 'bg-running animate-pulse' : 'bg-success'}`}></div>
                        <span className="text-sm">{running ? 'Génération en cours' : 'En attente de démarrage'}</span>
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] mt-2">
                        {running 
                          ? 'Le système est en train de générer votre vidéo. Cela peut prendre quelques minutes.' 
                          : 'Cliquez sur l\'orbe pour commencer la génération d\'une nouvelle vidéo.'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Detailed view - Raw terminal/logs
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="p-3 border-b border-[var(--border-color)]">
                  <h3 className="font-medium">Événements système</h3>
                </div>
                <div className="flex-1 overflow-auto p-3">
                  <ul className="space-y-2">
                    {events.slice(-30).map((e, i) => (
                      <li key={e.ts + '-' + i} className="flex items-start gap-2 p-2 rounded hover:bg-[var(--bg-primary)]">
                        <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                          e.kind==='error' ? 'bg-error' : 
                          e.kind==='success' ? 'bg-success' : 
                          e.kind==='step' || e.kind==='start' ? 'bg-running' : 'bg-pending'
                        }`}></span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm break-words">{e.text}</div>
                          <div className="text-[10px] text-[var(--text-secondary)] mt-1">{new Date(e.ts).toLocaleTimeString()}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="p-3 border-t border-[var(--border-color)]">
                  <h3 className="font-medium mb-2">Journal technique</h3>
                  <div ref={termRef} className="h-32 overflow-auto font-mono text-[11px] bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2">
                    <div className="space-y-1">
                      {lines.slice(-50).map((l, i) => (
                        <div key={l.ts + '-' + i} className="whitespace-pre text-[var(--text-primary)]">{l.line}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Controls moved to the side panel */}
            <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
              <h3 className="font-medium mb-3">Contrôles de génération</h3>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  disabled={!running} 
                  onClick={async () => { await fetch('/api/pause', { method: 'POST' }) }} 
                  className="px-3 py-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-primary)] active:bg-[var(--bg-secondary)] disabled:opacity-40 text-sm transition-colors flex flex-col items-center gap-1"
                >
                  <span className="text-lg">⏸️</span>
                  <span>Pause</span>
                </button>
                <button 
                  disabled={!running} 
                  onClick={async () => { await fetch('/api/resume', { method: 'POST' }) }} 
                  className="px-3 py-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-primary)] active:bg-[var(--bg-secondary)] disabled:opacity-40 text-sm transition-colors flex flex-col items-center gap-1"
                >
                  <span className="text-lg">▶️</span>
                  <span>Reprendre</span>
                </button>
                <button 
                  disabled={!running} 
                  onClick={async () => { await fetch('/api/abort', { method: 'POST' }) }} 
                  className="px-3 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 active:bg-red-500/20 disabled:opacity-40 text-sm transition-colors flex flex-col items-center gap-1"
                >
                  <span className="text-lg">⏹️</span>
                  <span>Stop</span>
                </button>
                {latestVideo && (
                  <a 
                    href={latestVideo} 
                    download 
                    className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm transition-colors flex flex-col items-center gap-1"
                  >
                    <span className="text-lg">💾</span>
                    <span>Télécharger</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="p-3 text-center text-[11px] text-[var(--text-secondary)] border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
        Frontend expérimental. It Was Not About - Générateur de vidéos YouTube Shorts
      </footer>
```

      {showSettings && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-6 w-full max-w-lg shadow-2xl">
            <h3 className="font-semibold mb-4">Clés API et Paramètres</h3>
            <div className="space-y-3">
              {['GOOGLE_API_KEY','GEMINI_API_KEY','OPENAI_API_KEY'].map(k => (
                <div key={k}>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">{k}</label>
                  <input className="w-full px-3 py-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)]" type="text" value={envVals[k]||''} onChange={e => setEnvVals(v => ({...v,[k]:e.target.value}))} />
                </div>
              ))}
              
              {/* Light/Dark Mode Switch */}
              <div className="pt-4">
                <label className="block text-sm text-[var(--text-secondary)] mb-2">Thème</label>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => document.documentElement.classList.remove('dark')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      !document.documentElement.classList.contains('dark') 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                    }`}
                  >
                    Mode Clair
                  </button>
                  <button 
                    onClick={() => document.documentElement.classList.add('dark')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      document.documentElement.classList.contains('dark') 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                    }`}
                  >
                    Mode Sombre
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowSettings(false)} className="px-3 py-1 rounded border border-[var(--border-color)] hover:bg-[var(--bg-secondary)]">Annuler</button>
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
