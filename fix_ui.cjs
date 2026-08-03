const fs = require('fs');

let code = fs.readFileSync('src/components/LandingPerfil.jsx', 'utf8');

// 1. Fix fetch
code = code.replace(
  /supabase\.from\('juegos'\)\.select\('id, nombre'\)\.eq\('activo', true\)/,
  "supabase.from('juegos').select('id, nombre, logo_url').eq('activo', true)"
);

// 2. Fix mapping
const mapSearch = `{catalogoJuegos.map(juego => (
                            <div 
                              key={juego.id} 
                              onClick={() => toggleJuegoFavorito(juego.id)}
                              style={{ 
                                padding: '5px 10px', 
                                borderRadius: '20px', 
                                background: juegosFavoritos.includes(juego.id) ? 'var(--accent)' : 'var(--bg-lighter)',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '12px',
                                transition: '0.2s',
                                border: juegosFavoritos.includes(juego.id) ? '1px solid var(--accent)' : '1px solid transparent'
                              }}
                            >
                              {juego.nombre}
                            </div>
                          ))}`;

const mapReplace = `{catalogoJuegos.map(juego => (
                            <div 
                              key={juego.id} 
                              onClick={() => toggleJuegoFavorito(juego.id)}
                              title={juego.nombre}
                              style={{ 
                                width: '40px',
                                height: '40px',
                                borderRadius: '8px',
                                background: 'var(--bg-lighter)',
                                cursor: 'pointer',
                                transition: '0.2s',
                                border: juegosFavoritos.includes(juego.id) ? '2px solid var(--accent)' : '2px solid transparent',
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                filter: juegosFavoritos.includes(juego.id) ? 'none' : 'grayscale(100%) opacity(0.7)'
                              }}
                            >
                              {juego.logo_url ? (
                                <img 
                                  src={getOptimizedImageUrl(juego.logo_url, 100)} 
                                  alt={juego.nombre} 
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                />
                              ) : (
                                <span style={{ fontSize: '10px', color: 'white', textAlign: 'center' }}>{juego.nombre.substring(0, 3)}</span>
                              )}
                            </div>
                          ))}`;

code = code.replace(mapSearch, mapReplace);

fs.writeFileSync('src/components/LandingPerfil.jsx', code);
console.log('Fixed games UI');
