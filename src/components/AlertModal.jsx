import React from 'react';

/**
 * AlertModal - Un componente de diálogo personalizado que reemplaza window.alert() y window.confirm()
 * 
 * @param {boolean} isOpen - Controla la visibilidad del modal
 * @param {string} type - El tipo de alerta: 'info', 'success', 'warning', 'error', 'confirm'
 * @param {string} title - Título del modal (opcional, tiene valores por defecto)
 * @param {string} message - El mensaje principal a mostrar
 * @param {function} onConfirm - Función a ejecutar al aceptar/confirmar
 * @param {function} onCancel - Función a ejecutar al cancelar (solo para tipo 'confirm')
 */
const AlertModal = ({ isOpen, type = 'info', title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  const isConfirm = type === 'confirm';
  
  // Mapeo de colores basado en el diseño del sistema
  const colors = {
    error: '#ff5252',
    warning: '#ffab00',
    success: '#22c55e',
    confirm: '#00d2ff', // var(--accent-primary) aproximado
    info: '#00d2ff'
  };
  
  const icons = {
    error: '❌',
    warning: '⚠️',
    success: '✅',
    confirm: '❓',
    info: 'ℹ️'
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, backdropFilter: 'blur(10px)', animation: 'fadeIn 0.2s ease'
    }}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <div style={{
        backgroundColor: '#1a1d21', width: '90%', maxWidth: '400px', borderRadius: '24px',
        padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.05)',
        position: 'relative', textAlign: 'center'
      }} onClick={e => e.stopPropagation()}>
        <div style={{ 
          fontSize: '48px', marginBottom: '16px', 
          color: colors[type] || colors.info 
        }}>
          {icons[type] || icons.info}
        </div>
        
        <h3 style={{ color: '#fff', fontSize: '20px', marginBottom: '12px', fontWeight: 700 }}>
          {title || (type === 'confirm' ? 'Confirmación' : 'Mensaje del Sistema')}
        </h3>
        
        <p style={{ color: '#94a3b8', fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>
          {message}
        </p>
        
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          {isConfirm && (
            <button 
              onClick={onCancel}
              style={{
                padding: '12px 24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
                backgroundColor: 'transparent', color: '#fff', fontWeight: 600, cursor: 'pointer', flex: 1,
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
            >
              Cancelar
            </button>
          )}
          <button 
            onClick={onConfirm}
            style={{
              padding: '12px 24px', borderRadius: '12px', border: 'none',
              backgroundColor: colors[type] || colors.info,
              color: '#fff', fontWeight: 700, cursor: 'pointer', flex: 1,
              transition: 'all 0.2s',
              boxShadow: `0 4px 12px ${colors[type] || colors.info}40`
            }}
            onMouseEnter={e => e.target.style.filter = 'brightness(1.1)'}
            onMouseLeave={e => e.target.style.filter = 'none'}
          >
            {isConfirm ? 'Confirmar' : 'Aceptar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertModal;
