import React, { useState, useEffect } from 'react'

export default function MandatoryFlyerModal({ isOpen, flyerUrl, durationSecs, onComplete }) {
  if (!isOpen) return null

  const [timeLeft, setTimeLeft] = useState(durationSecs || 0)
  const [canClose, setCanClose] = useState(durationSecs <= 0)

  // Temporizador para el flyer
  useEffect(() => {
    if (!isOpen) return

    setCanClose(durationSecs <= 0)
    setTimeLeft(durationSecs || 0)

    if (durationSecs > 0) {
      const interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval)
            setCanClose(true)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [isOpen, durationSecs])

  const handleClose = () => {
    if (canClose) {
      onComplete()
    }
  }

  // Estilos embebidos basados en el modal del tutorial
  return (
    <div className="tutorial-modal-overlay">
      <style>{`
        .tutorial-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background-color: rgba(0, 0, 0, 0.95);
          backdrop-filter: blur(8px);
          z-index: 999999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }

        .tutorial-modal-content {
          background-color: #1a1b1e;
          width: 100%;
          max-width: 600px;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.1);
          animation: modalPopIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .flyer-container {
          position: relative;
          width: 100%;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 250px;
        }

        .flyer-container img {
          width: 100%;
          max-height: 75vh;
          display: block;
          object-fit: contain;
        }

        .modal-footer {
          padding: 20px;
          background-color: #1a1b1e;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          text-align: center;
        }

        .btn-continue {
          width: 100%;
          padding: 16px 24px;
          border: none;
          border-radius: 12px;
          font-weight: 700;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }

        .btn-continue.locked {
          background-color: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.5);
          cursor: not-allowed;
        }

        .btn-continue.unlocked {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          color: white;
          box-shadow: 0 4px 15px rgba(0, 242, 254, 0.3);
        }

        .btn-continue.unlocked:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 242, 254, 0.4);
        }

        @keyframes modalPopIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      <div className="tutorial-modal-content">
        <div className="flyer-container">
          {flyerUrl ? (
            <img src={flyerUrl} alt="Aviso Importante" />
          ) : (
            <div style={{ height: '200px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
              El aviso no está disponible.
            </div>
          )}
        </div>

        <div className="modal-footer">
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginBottom: '12px', marginTop: 0 }}>
            {canClose 
              ? 'Puedes continuar navegando.' 
              : `Espera ${timeLeft} segundos para continuar.`}
          </p>
          <button 
            className={`btn-continue ${canClose ? 'unlocked' : 'locked'}`}
            onClick={handleClose}
            disabled={!canClose}
          >
            {canClose ? 'Entendido / Continuar' : `Cargando... (${timeLeft}s)`}
          </button>
        </div>
      </div>
    </div>
  )
}
