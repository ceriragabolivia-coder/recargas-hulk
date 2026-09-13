const fs = require('fs');
let src = fs.readFileSync('src/components/GestionCupones.jsx', 'utf8');

const insertJsx = `
                  <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                    <h4 style={{ color: '#a855f7', fontWeight: 'bold', marginBottom: '8px' }}>Regalo Global</h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>Asigna este cupón a absolutamente todos los usuarios registrados en la plataforma.</p>
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      onClick={handleAssignToAll}
                      disabled={assignData.isAssigningAll}
                      style={{ width: '100%', background: '#a855f7', color: '#fff' }}
                    >
                      {assignData.isAssigningAll ? 'Procesando...' : '🎁 Regalar a Todos los Usuarios'}
                    </button>
                    {assignData.assignAllProgress && <p style={{ fontSize: '11px', color: '#a855f7', marginTop: '8px', textAlign: 'center' }}>{assignData.assignAllProgress}</p>}
                  </div>
                  
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 'bold' }}>O regala a un usuario específico:</div>
`;

src = src.replace(
  '<form onSubmit={handleAssignSubmit} style={{ display: \'flex\', flexDirection: \'column\', gap: \'16px\' }}>',
  '<form onSubmit={handleAssignSubmit} style={{ display: \'flex\', flexDirection: \'column\', gap: \'16px\' }}>' + insertJsx
);

fs.writeFileSync('src/components/GestionCupones.jsx', src);
