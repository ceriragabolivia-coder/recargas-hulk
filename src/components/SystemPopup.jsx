import React, { useState, useEffect } from 'react'
import { useMensajesSistema } from '../hooks/useData'
import DOMPurify from 'dompurify'

export default function SystemPopup() {
  const { mensajes: allMessages } = useMensajesSistema()
  const [activePopup, setActivePopup] = useState(null)
  const [doNotShowAgain, setDoNotShowAgain] = useState(false)

  useEffect(() => {
    console.log('SystemPopup: allMessages changed', allMessages)
    if (allMessages && allMessages.length > 0) {
      // Filtrar por activos y que estén dentro del horario programado
      const activeOne = allMessages.find(m => {
        if (!m.activo) return false;

        // Si no tiene horario programado, se muestra siempre
        if (!m.hora_inicio && !m.hora_fin) return true;

        try {
          // Obtener hora actual en Venezuela (UTC-4)
          const now = new Date();
          const vzlaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Caracas" }));
          const currentH = vzlaTime.getHours();
          const currentM = vzlaTime.getMinutes();
          const currentTimeStr = `${currentH.toString().padStart(2, '0')}:${currentM.toString().padStart(2, '0')}`;

          const start = m.hora_inicio || "00:00";
          const end = m.hora_fin || "23:59";

          if (start <= end) {
            // Rango normal (ej: 08:00 a 20:00)
            return currentTimeStr >= start && currentTimeStr <= end;
          } else {
            // Rango nocturno (ej: 22:00 a 08:00)
            return currentTimeStr >= start || currentTimeStr <= end;
          }
        } catch (e) {
          console.error("Error checking popup schedule:", e);
          return true; // Fallback: mostrar si hay error
        }
      })

      if (activeOne) {
        const id = activeOne.id
        const now = Date.now()
        
        // Verificar si está muteado por 5 horas (session)
        const muteUntil = localStorage.getItem(`popup_muted_until_${id}`)
        if (muteUntil && parseInt(muteUntil) > now) {
          console.log('SystemPopup: Popup is muted until', new Date(parseInt(muteUntil)))
          return
        }

        // Verificar contador de vistas (Max 3)
        const viewCount = parseInt(localStorage.getItem(`popup_count_${id}`) || '0')
        if (viewCount >= 3) {
          console.log('SystemPopup: Popup view count limit reached', viewCount)
          return
        }

        // Si pasó los filtros, lo mostramos e incrementamos el contador
        localStorage.setItem(`popup_count_${id}`, (viewCount + 1).toString())
        setActivePopup(activeOne)
        setDoNotShowAgain(false)
      }
    }
  }, [allMessages])

  const handleClosePopup = () => {
    if (doNotShowAgain && activePopup) {
      const fiveHours = Date.now() + 5 * 60 * 60 * 1000
      localStorage.setItem(`popup_muted_until_${activePopup.id}`, fiveHours.toString())
    }
    setActivePopup(null)
  }

  if (!activePopup) return null

  return (
    <div 
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 999999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', animation: 'fadeIn 0.3s ease'
      }}
      onClick={handleClosePopup}
    >
      <div 
        style={{
          backgroundColor: 'var(--bg-secondary, #111128)', color: 'var(--text-primary, #e8e8f0)', width: '95%', maxWidth: '500px',
          borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
          position: 'relative', overflowY: 'auto', maxHeight: '90vh',
          animation: 'scaleUp 0.3s ease',
          display: 'block'
        }}
        onClick={e => e.stopPropagation()}
      >
        <style>{`
          @keyframes scaleUp { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        `}</style>
        
        <button 
          style={{
            position: 'absolute', top: '16px', right: '16px', borderRadius: '50%',
            width: '32px', height: '32px', backgroundColor: 'rgba(255,255,255,0.05)',
            border: 'none', color: '#fff', cursor: 'pointer', zIndex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px'
          }}
          onClick={handleClosePopup}
        >✕</button>

        {activePopup.imagen_url && (
          <div style={{ width: '100%' }}>
            {activePopup.link_url ? (
              <a href={activePopup.link_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                <img src={activePopup.imagen_url} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
              </a>
            ) : (
              <img src={activePopup.imagen_url} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
            )}
          </div>
        )}

        <div style={{ padding: '32px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', marginBottom: '16px' }}>
            {activePopup.titulo}
          </h2>
          <div 
            style={{ fontSize: '16px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '24px', whiteSpace: 'pre-line' }}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(activePopup.contenido) }}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '20px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <input 
              type="checkbox" 
              id="dont-show-msg-global"
              checked={doNotShowAgain}
              onChange={(e) => setDoNotShowAgain(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
            />
            <label htmlFor="dont-show-msg-global" style={{ fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 500 }}>
              No mostrar por 5 horas
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activePopup.link_url && (
              <a 
                href={activePopup.link_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ width: '100%', height: '48px', fontSize: '16px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                Ir ahora
              </a>
            )}
            <button 
              className={activePopup.link_url ? "btn btn-ghost" : "btn btn-primary"} 
              style={{ width: '100%', height: '48px', fontSize: '16px' }}
              onClick={handleClosePopup}
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
