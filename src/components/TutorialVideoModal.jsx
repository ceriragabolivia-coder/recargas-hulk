import React from 'react'

export default function TutorialVideoModal({ isOpen, onClose, videoUrl, title }) {
  if (!isOpen) return null

  // Function to convert YouTube URL to embed URL
  const getEmbedUrl = (url) => {
    if (!url) return ''
    if (url.includes('youtube.com/embed/')) return url
    if (url.includes('youtube.com/watch?v=')) {
      const id = url.split('v=')[1]?.split('&')[0]
      return `https://www.youtube.com/embed/${id}?autoplay=1`
    }
    if (url.includes('youtu.be/')) {
      const id = url.split('youtu.be/')[1]?.split('?')[0]
      return `https://www.youtube.com/embed/${id}?autoplay=1`
    }
    return url
  }

  const [isVertical, setIsVertical] = React.useState(false)
  const embedUrl = getEmbedUrl(videoUrl)
  const isYouTube = videoUrl && (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be'))

  const handleLoadedMetadata = (e) => {
    if (e.target.videoHeight > e.target.videoWidth) {
      setIsVertical(true)
    }
  }

  return (
    <div 
      className="modal-overlay" 
      style={{ 
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 20000, animation: 'fadeIn 0.3s ease-out', padding: '16px'
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .tutorial-modal-content {
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          background: var(--bg-panel, #1a1c1e);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          width: 100%;
          max-width: ${isVertical ? '400px' : '800px'};
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          position: relative;
          transition: max-width 0.3s ease;
        }
        .video-container {
          position: relative;
          width: 100%;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .video-container.ratio-16-9 {
          padding-bottom: 56.25%;
          height: 0;
        }
        .video-container iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border: none;
        }
        .video-container video {
          width: 100%;
          max-height: 70vh;
          display: block;
          object-fit: contain;
        }
        .close-btn {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          z-index: 100;
          font-size: 18px;
        }
        .close-btn:hover {
          background: rgba(255, 82, 82, 0.9);
          transform: scale(1.1);
        }
        .modal-header {
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          gap: 12px;
          padding-right: 60px; /* Space for close button */
        }
        .modal-title {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: white;
          line-height: 1.2;
        }
        @media (max-width: 600px) {
          .tutorial-modal-content {
            border-radius: 20px;
          }
          .modal-title {
            font-size: 14px;
          }
        }
      `}</style>
      
      <div className="tutorial-modal-content" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        
        <div className="modal-header">
          <div style={{ fontSize: '20px' }}>🎬</div>
          <h2 className="modal-title">{title || 'Video Tutorial'}</h2>
        </div>
        
        <div className={`video-container ${isYouTube ? 'ratio-16-9' : ''}`}>
          {videoUrl ? (
            isYouTube ? (
              <iframe 
                src={embedUrl} 
                title={title || 'Tutorial'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              ></iframe>
            ) : (
              <video 
                controls 
                autoPlay 
                onLoadedMetadata={handleLoadedMetadata}
                style={{ backgroundColor: '#000' }}
              >
                <source src={videoUrl} type="video/mp4" />
                <source src={videoUrl} type="video/webm" />
                <source src={videoUrl} type="video/ogg" />
                Tu navegador no soporta el tag de video.
              </video>
            )
          ) : (
            <div style={{ height: '200px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
              No se ha configurado un video para este tutorial.
            </div>
          )}
        </div>
        
        <div style={{ padding: '16px 20px', backgroundColor: 'rgba(255, 255, 255, 0.02)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', lineHeight: 1.4 }}>
            ¿Tienes dudas? Contáctanos por nuestro canal oficial.
          </p>
          <button 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '12px', fontWeight: 700 }}
            onClick={onClose}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
