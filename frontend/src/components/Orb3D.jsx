import React, { useEffect, useRef, useState } from 'react'

// Orbe animée de type "Siri" qui reste cliquable pour démarrer/relancer
export default function Orb3D({ onClick, running }) {
  const orbRef = useRef(null)
  const [hovered, setHovered] = useState(false)
  const [hue, setHue] = useState(210) // point de départ froid
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 })

  // Animation continue de la teinte (changements de couleurs dans le temps)
  useEffect(() => {
    let raf
    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min(100, now - last)
      last = now
      // vitesse de rotation de teinte (plus rapide au survol)
      const speed = hovered ? 0.038 : 0.022 // deg/ms ~ 2.2deg/s ou 3.8deg/s
      setHue((h) => (h + dt * speed) % 360)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [hovered])

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick?.()
    }
  }

  function handleMouseMove(e) {
    const el = orbRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    setMouse({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) })
  }

  return (
    <div className="relative mx-auto my-6 flex flex-col items-center justify-center select-none">
      <div
        ref={orbRef}
        role="button"
        aria-label={running ? 'Génération en cours' : 'Démarrer la génération'}
        tabIndex={0}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onMouseMove={handleMouseMove}
        className={`relative w-[360px] h-[360px] rounded-full cursor-pointer outline-none 
          transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]
          hover:scale-[1.03] active:scale-[0.98]
          drop-shadow-[0_30px_80px_rgba(99,102,241,0.35)]
        `}
      >
        {/* Calculs de teintes et position */}
        {(() => {
          const h1 = hue % 360
          const h2 = (hue + 120) % 360
          const h3 = (hue + 240) % 360
          const sGlow = hovered ? 92 : 88
          const aGlow = hovered ? 0.32 : 0.24
          const shift = hovered ? 8 : 5
          const mx = (mouse.x - 0.5) * shift
          const my = (mouse.y - 0.5) * shift

          // Styles dynamiques construits une seule fois par render
          const glowStyle = {
            background: `conic-gradient(from 0deg at 50% 50%, 
              hsl(${h1} ${sGlow}% 60% / ${aGlow}), 
              hsl(${h2} ${sGlow}% 60% / ${aGlow}), 
              hsl(${h3} ${sGlow}% 60% / ${aGlow}), 
              hsl(${h1} ${sGlow}% 60% / ${aGlow})
            )`,
          }

          const layerStyle = {
            background: `
              radial-gradient(60% 60% at ${30 + mx}% ${30 + my}%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 60%),
              radial-gradient(65% 65% at ${70 - mx}% ${70 - my}%, hsl(${h1} 70% 65% / 0.55) 0%, rgba(255,255,255,0) 60%),
              conic-gradient(from 180deg at 50% 50%, hsl(${h1} 80% 55% / 0.55), hsl(${h2} 80% 55% / 0.55), hsl(${h3} 80% 55% / 0.55), hsl(${h1} 80% 55% / 0.55))
            `,
            filter: `blur(${hovered ? 8 : 6}px) saturate(${hovered ? 140 : 120}%)`,
          }

          const highlightStyle = {
            background: 'radial-gradient(120% 70% at 30% 25%, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0) 55%)',
          }

          return (
            <>
              {/* Glow externe */}
              <div
                className={`absolute inset-0 rounded-full blur-2xl opacity-80 
                  ${running ? 'animate-orb-spin-fast' : 'animate-orb-spin'}`}
                style={glowStyle}
              />

              {/* Noyau principal */}
              <div className="absolute inset-0 rounded-full overflow-hidden">
                {/* Couche dégradé dynamique */}
                <div
                  className={`absolute -inset-[10%] rounded-full mix-blend-screen 
                    ${running ? 'animate-orb-rotate-fast' : 'animate-orb-rotate'}`}
                  style={layerStyle}
                />

                {/* Vagues lumineuses ("voix") */}
                <div className="absolute inset-0 rounded-full">
                  <span
                    className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 
                      w-[68%] h-[68%] rounded-full bg-white/8 blur-md 
                      ${running ? 'animate-orb-breathe-fast' : 'animate-orb-breathe'}`}
                  />
                  <span
                    className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 
                      w-[78%] h-[78%] rounded-full bg-white/6 blur-lg 
                      ${running ? 'animate-orb-breathe' : 'animate-orb-breathe-slow'}`}
                  />
                  <span
                    className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 
                      w-[86%] h-[86%] rounded-full bg-white/5 blur-[18px] 
                      ${running ? 'animate-orb-breathe-slow' : 'animate-orb-breathe'}`}
                  />
                </div>

                {/* Reflet subtil */}
                <div className="absolute inset-0 rounded-full" style={highlightStyle} />
              </div>
            </>
          )
        })()}
  {/* Contour interne pour la profondeur */}
        <div className="absolute inset-0 rounded-full ring-1 ring-white/15" />

        {/* Pulsation si running */}
        {running && (
          <div className="absolute inset-0 rounded-full bg-fuchsia-400/10 animate-pulse" />
        )}
      </div>

      {/* Légende d’état (visuellement légère) */}

      {/* Styles locaux pour animations de l’orbe */}
      <style>{`
        @keyframes orb-rotate { to { transform: rotate(360deg); } }
        @keyframes orb-rotate-fast { to { transform: rotate(360deg); } }
        @keyframes orb-spin { to { transform: rotate(-360deg); } }
        @keyframes orb-spin-fast { to { transform: rotate(-360deg); } }
        @keyframes orb-breathe { 0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: .85 } 50% { transform: translate(-50%, -50%) scale(1.06); opacity: 1 } }
        @keyframes orb-breathe-slow { 0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: .7 } 50% { transform: translate(-50%, -50%) scale(1.03); opacity: .9 } }
        @keyframes orb-breathe-fast { 0%, 100% { transform: translate(-50%, -50%) scale(1.02); opacity: .9 } 50% { transform: translate(-50%, -50%) scale(1.09); opacity: 1 } }

        .animate-orb-rotate { animation: orb-rotate 14s linear infinite; }
        .animate-orb-rotate-fast { animation: orb-rotate-fast 8s linear infinite; }
        .animate-orb-spin { animation: orb-spin 18s linear infinite; }
        .animate-orb-spin-fast { animation: orb-spin-fast 10s linear infinite; }
        .animate-orb-breathe { animation: orb-breathe 3.5s ease-in-out infinite; }
        .animate-orb-breathe-slow { animation: orb-breathe-slow 5.5s ease-in-out infinite; }
        .animate-orb-breathe-fast { animation: orb-breathe-fast 2.4s ease-in-out infinite; }
      `}</style>
    </div>
  )
}
