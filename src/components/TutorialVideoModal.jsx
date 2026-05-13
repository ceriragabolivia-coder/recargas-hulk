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

  const embedUrl = getEmbedUrl(videoUrl)

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
          max-width: 800px;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          position: relative;
        }
        .video-container {
          position: relative;
          padding-bottom: 56.25%; /* 16:9 */
          height: 0;
          overflow: hidden;
          background: #000;
        }
        .video-container iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border: none;
        }
        .close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          display: flex;
          alignItems: center;
          justifyContent: center;
          cursor: pointer;
          transition: all 0.2s;
          z-index: 10;
          font-size: 20px;
        }
        .close-btn:hover {
          background: rgba(255, 82, 82, 0.8);
          transform: scale(1.1);
        }
        .modal-header {
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .modal-title {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: white;
        }
      `}</style>
      
      <div className="tutorial-modal-content" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>
        
        <div className="modal-header">
          <div style={{ fontSize: '24px' }}>🎬</div>
          <h2 className="modal-title">{title || 'Video Tutorial'}</h2>
        </div>
        
        <div className="video-container">
          {videoUrl ? (
            <iframe 
              src={embedUrl} 
              title={title || 'Tutorial'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
            ></iframe>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              No se ha configurado un video para este tutorial.
            </div>
          )}
        </div>
        
        <div style={{ padding: '20px 24px', backgroundColor: 'rgba(0, 210, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)' }}>
            ¿Tienes dudas? Contáctanos por nuestro canal oficial.
          </p>
          <button 
            className="btn btn-primary" 
            style={{ padding: '8px 16px', fontSize: '13px' }}
            onClick={onClose}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
