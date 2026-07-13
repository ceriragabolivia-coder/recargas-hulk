const fs = require('fs');

let src = fs.readFileSync('src/components/Landing.jsx', 'utf8');

const targetFooter = `<div className="footer-grid-new">
            {/* Col 1: Brand */}
            <div className="footer-col-brand">
              <div className="landing-logo-container" onClick={() => handleSelectJuego(null)} style={{ marginBottom: '16px' }}>
                {config?.landing_logo ? (
                  <img src={config.landing_logo} alt="Logo" style={{ height: '44px', width: 'auto', maxWidth: '220px', objectFit: 'contain' }} />
                ) : (
                  <>
                    <div className="landing-logo-icon">🚀</div>
                    <span className="landing-logo-text">{config?.landing_titulo || 'Recargas Hulk'}</span>
                  </>
                )}
              </div>
            </div>

            {/* Col 2: Productos */}
            <div className="footer-col-products">
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Productos</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {(() => {
                    let ids = []
                    try { ids = JSON.parse(config?.footer_productos_ids || '[]') } catch(e) {}
                    const footerJuegos = ids.length > 0
                      ? ids.map(id => juegos.find(j => j.id === id)).filter(Boolean)
                      : juegos.slice(0, 8)
                    return footerJuegos
                  })().map(j => (
                  <button
                    key={j.id}
                    onClick={() => handleSelectJuego(j)}
                    className="footer-product-btn"
                  >
                    {j.icono_url ? (
                      <img src={j.icono_url ? (j.icono_url.includes('?') ? \`\${j.icono_url}&v=3\` : \`\${j.icono_url}?v=3\`) : ''} alt="" style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'linear-gradient(135deg, var(--accent), #00d2ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>🎮</div>
                    )}
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#c8d6e8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.nombre}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>`;

const replaceFooter = `<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="footer-col-products" style={{ width: '100%', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '24px' }}>Nuestros Servicios</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center' }}>
                {(() => {
                    let ids = []
                    try { ids = JSON.parse(config?.footer_productos_ids || '[]') } catch(e) {}
                    const footerJuegos = ids.length > 0
                      ? ids.map(id => juegos.find(j => j.id === id)).filter(Boolean)
                      : juegos.slice(0, 8)
                    return footerJuegos
                  })().map(j => (
                  <button
                    key={j.id}
                    onClick={() => handleSelectJuego(j)}
                    title={j.nombre}
                    style={{ 
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0, 
                      transition: 'transform 0.2s', outline: 'none'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {j.icono_url ? (
                      <img src={j.icono_url ? (j.icono_url.includes('?') ? \`\${j.icono_url}&v=3\` : \`\${j.icono_url}?v=3\`) : ''} alt={j.nombre} style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--accent), #00d2ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🎮</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>`;

src = src.replace(/\r\n/g, '\n');
src = src.replace(targetFooter.replace(/\r\n/g, '\n'), replaceFooter);

fs.writeFileSync('src/components/Landing.jsx', src);
