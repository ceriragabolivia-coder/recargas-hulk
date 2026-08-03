const fs = require('fs');
let code = fs.readFileSync('src/components/Usuarios.jsx', 'utf8');

const target = \                                </div>
                              </div>
                              </>
                            )}\;

const replacement = \                                </div>
                              </div>
                              <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Juegos/Servicios Favoritos</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                                  {(!editingData.juegos_favoritos || editingData.juegos_favoritos.length === 0) ? (
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Ninguno seleccionado</span>
                                  ) : (
                                    juegos?.filter(j => editingData.juegos_favoritos.includes(j.id)).map(juego => (
                                      <div key={juego.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-primary)' }}>
                                        <span>? {juego.nombre}</span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                              </>
                            )}\;

code = code.replace(target, replacement);

fs.writeFileSync('src/components/Usuarios.jsx', code);
console.log('Fixed admin favorites');

