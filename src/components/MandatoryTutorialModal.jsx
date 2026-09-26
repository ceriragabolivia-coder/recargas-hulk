import React, { useState, useRef, useEffect } from 'react'

export default function MandatoryTutorialModal({ isOpen, videoUrl, title, onComplete }) {
  if (!isOpen) return null

  const videoRef = useRef(null)
  const [progress, setProgress] = useState(0)
  const [isCompleted, setIsCompleted] = useState(false)
  const [isVertical, setIsVertical] = useState(false)
  const [playError, setPlayError] = useState(false)

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime
      const duration = videoRef.current.duration
      if (duration > 0) {
        setProgress(current / duration)
      }
    }
  }

  const handleEnded = () => {
    setIsCompleted(true)
    setProgress(1)
  }

  const handleLoadedMetadata = (e) => {
    if (e.target.videoHeight > e.target.videoWidth) {
      setIsVertical(true)
    } else {
      setIsVertical(false)
    }
  }

  useEffect(() => {
    if (videoRef.current) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn("Autoplay bloqueado por el navegador:", error);
          setPlayError(true);
        });
      }
    }
  }, [videoUrl]);

  const forcePlay = () => {
    if (videoRef.current) {
      videoRef.current.play().then(() => {
        setPlayError(false);
      }).catch(err => console.error(err));
    }
  }

  return (
    <div 
      className="modal-overlay" 
      style={{ 
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.95)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 99999, animation: 'fadeIn 0.3s ease-out', padding: '16px'
      }}
      // Evitamos el onClick para que no se cierre al hacer click afuera
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .tutorial-modal-content {
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          background: var(--bg-panel, #1a1c1e);
          border: 1px solid rgba(0, 210, 255, 0.2);
          border-radius: 24px;
          width: 100%;
          max-width: ${isVertical ? '400px' : '800px'};
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 210, 255, 0.2);
          position: relative;
          transition: max-width 0.3s ease;
        }
        .video-container {
          position: relative;
          width: 100%;
          min-height: 300px; /* Asegura espacio para el botón de play si el video colapsa */
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .video-container video {
          width: 100%;
          max-height: 65vh;
          display: block;
          object-fit: contain;
          pointer-events: none; /* Deshabilita clics en el video (como pausar o menú contextual) */
        }
        .modal-header {
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          background: rgba(0, 210, 255, 0.05);
        }
        .modal-title {
          margin: 0;
          font-size: 16px;
          font-weight: 800;
          color: white;
          line-height: 1.2;
          text-align: center;
        }
        .btn-progress-container {
          position: relative;
          width: 100%;
          height: 48px;
          border-radius: 12px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.05);
          cursor: not-allowed;
        }
        .btn-progress-container.completed {
          cursor: pointer;
        }
        .btn-progress-bar {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          background: linear-gradient(90deg, #00d2ff 0%, #3a7bd5 100%);
          transition: width 0.1s linear;
          z-index: 1;
        }
        .btn-progress-text {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 15px;
          color: white;
          z-index: 2;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        }
        @media (max-width: 600px) {
          .tutorial-modal-content {
            border-radius: 20px;
            max-width: 100%;
          }
          .modal-title {
            font-size: 14px;
          }
        }
      `}</style>
      
      <div className="tutorial-modal-content">
        <div className="modal-header">
          <div style={{ fontSize: '20px' }}>⚠️</div>
          <h2 className="modal-title">{title || 'Tutorial Importante'}</h2>
        </div>
        
        <div className="video-container">
          {videoUrl ? (
            <>
              <video 
                ref={videoRef}
                autoPlay 
                playsInline
                preload="auto"
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                style={{ backgroundColor: '#000', minHeight: '100%' }}
                controls={false}
                disablePictureInPicture
                controlsList="nodownload nofullscreen noremoteplayback"
              >
                <source src={videoUrl} type="video/mp4" />
                Tu navegador no soporta el tag de video.
              </video>
              
              {playError && (
                <div 
                  onClick={forcePlay}
                  style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', zIndex: 10, cursor: 'pointer'
                  }}
                >
                  <div style={{
                    width: '70px', height: '70px', backgroundColor: 'var(--accent-primary, #39ff14)',
                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '15px', boxShadow: '0 0 20px rgba(57,255,20,0.5)'
                  }}>
                    <span style={{ fontSize: '30px', color: '#000', marginLeft: '5px' }}>▶</span>
                  </div>
                  <h3 style={{ color: '#fff', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                    Toca aquí para reproducir
                  </h3>
                </div>
              )}
            </>
          ) : (
            <div style={{ height: '200px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
              El video no está disponible.
            </div>
          )}
        </div>
        
        <div style={{ padding: '20px', backgroundColor: 'rgba(255, 255, 255, 0.02)', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
          <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.4, textAlign: 'center', fontWeight: '500' }}>
            Mira el video completo para seguir en la página
          </p>
          
          <div 
            className={`btn-progress-container ${isCompleted ? 'completed' : ''}`}
            onClick={() => {
              if (isCompleted && onComplete) {
                onComplete()
              }
            }}
          >
            <div 
              className="btn-progress-bar" 
              style={{ width: `${progress * 100}%` }}
            />
            <div className="btn-progress-text">
              {isCompleted ? 'Continuar en la página' : 'Reproduciendo...'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
