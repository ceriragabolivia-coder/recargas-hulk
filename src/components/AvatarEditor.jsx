import React, { useState, useRef, useEffect } from 'react';

/**
 * AvatarEditor: Un componente simple para mover y escalar una imagen antes de subirla.
 * Utiliza Canvas para generar el recorte final.
 */
export default function AvatarEditor({ imageSrc, onSave, onCancel }) {
  const [position, setPosition] = useState({ x: 0.5, y: 0.5 }); // Normalizado 0 a 1
  const [scale, setScale] = useState(1.2);
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    isDragging.current = true;
    startPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    
    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    
    const container = containerRef.current.getBoundingClientRect();
    
    setPosition(prev => ({
      x: Math.max(0, Math.min(1, prev.x - dx / (container.width * scale))),
      y: Math.max(0, Math.min(1, prev.y - dy / (container.height * scale)))
    }));
    
    startPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleTouchStart = (e) => {
    isDragging.current = true;
    startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchMove = (e) => {
    if (!isDragging.current) return;
    const dx = e.touches[0].clientX - startPos.current.x;
    const dy = e.touches[0].clientY - startPos.current.y;
    
    const container = containerRef.current.getBoundingClientRect();
    
    setPosition(prev => ({
      x: Math.max(0, Math.min(1, prev.x - dx / (container.width * scale))),
      y: Math.max(0, Math.min(1, prev.y - dy / (container.height * scale)))
    }));
    
    startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const generateResult = () => {
    const canvas = document.createElement('canvas');
    const size = 400; // Resolución final del avatar
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    const img = imageRef.current;
    const aspect = img.naturalWidth / img.naturalHeight;
    
    let drawWidth, drawHeight;
    if (aspect > 1) {
      drawHeight = size * scale;
      drawWidth = drawHeight * aspect;
    } else {
      drawWidth = size * scale;
      drawHeight = drawWidth / aspect;
    }
    
    const offsetX = (size - drawWidth) * position.x;
    const offsetY = (size - drawHeight) * position.y;
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    
    canvas.toBlob((blob) => {
      onSave(blob);
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="avatar-editor-modal">
      <div className="avatar-editor-content">
        <h3>Ajustar Foto de Perfil</h3>
        <p>Arrastra para posicionar y usa la barra para el zoom</p>
        
        <div 
          className="crop-container" 
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
        >
          <img loading="lazy" decoding="async" ref={imageRef}
            src={imageSrc} 
            alt="To crop" 
            style={{
              transform: `scale(${scale}) translate(${(0.5 - position.x) * 100}%, ${(0.5 - position.y) * 100}%)`,
              cursor: 'move',
              userSelect: 'none',
              pointerEvents: 'none' // Evita interferencia con el drag del contenedor
            }}
          />
          <div className="crop-overlay"></div>
        </div>

        <div className="editor-controls">
          <div className="zoom-control">
            <span>➖</span>
            <input 
              type="range" 
              min="1" 
              max="3" 
              step="0.01" 
              value={scale} 
              onChange={(e) => setScale(parseFloat(e.target.value))} 
            />
            <span>➕</span>
          </div>
          
          <div className="editor-actions">
            <button className="btn-cancel" onClick={onCancel}>Cancelar</button>
            <button className="btn-confirm" onClick={generateResult}>Guardar Cambios</button>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .avatar-editor-modal {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50000;
          backdrop-filter: blur(8px);
          animation: fadeIn 0.3s ease;
        }
        .avatar-editor-content {
          background: #1a1b2e;
          padding: 30px;
          border-radius: 28px;
          width: 90%;
          maxWidth: 450px;
          text-align: center;
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }
        .avatar-editor-content h3 { margin: 0 0 8px 0; color: white; }
        .avatar-editor-content p { color: rgba(255,255,255,0.5); font-size: 14px; margin-bottom: 24px; }
        
        .crop-container {
          width: 280px;
          height: 280px;
          margin: 0 auto 30px;
          position: relative;
          overflow: hidden;
          border-radius: 50%;
          border: 4px solid var(--accent);
          background: #000;
          cursor: move;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .crop-container img {
          max-width: none;
          max-height: none;
          transition: transform 0.1s ease-out;
        }
        .crop-overlay {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          pointer-events: none;
          box-shadow: inset 0 0 0 100px rgba(0,0,0,0.3);
        }
        
        .editor-controls {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .zoom-control {
          display: flex;
          align-items: center;
          gap: 12px;
          justify-content: center;
        }
        .zoom-control input {
          width: 200px;
          accent-color: var(--accent);
        }
        
        .editor-actions {
          display: flex;
          gap: 12px;
        }
        .btn-cancel, .btn-confirm {
          flex: 1;
          padding: 12px;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }
        .btn-cancel {
          background: rgba(255,255,255,0.1);
          color: white;
        }
        .btn-confirm {
          background: var(--accent);
          color: white;
        }
        .btn-cancel:hover { background: rgba(255,255,255,0.2); }
        .btn-confirm:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(123, 47, 247, 0.4); }
      `}} />
    </div>
  );
}
