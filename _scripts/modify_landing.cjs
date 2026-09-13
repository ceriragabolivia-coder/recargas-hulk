const fs = require('fs');

let content = fs.readFileSync('c:\\hulk\\app\\src\\components\\LandingPerfil.jsx', 'utf-8');

// 1. ADD STATES
const states_to_add = `
  const [misCodigosCreador, setMisCodigosCreador] = useState([])
  const [loadingCodigos, setLoadingCodigos] = useState(true)

  const [objetivos, setObjetivos] = useState([])
  const [recompensasCanjeadas, setRecompensasCanjeadas] = useState([])
  const [redeemingObjetivoId, setRedeemingObjetivoId] = useState(null)
  
  const [showSelectPremioModal, setShowSelectPremioModal] = useState(false)
  const [objetivoToRedeem, setObjetivoToRedeem] = useState(null)
  const [codigoToRedeem, setCodigoToRedeem] = useState(null)
  
  const [miCodigoUsado, setMiCodigoUsado] = useState(null)
  
  const [showUsersModal, setShowUsersModal] = useState(false)
  const [selectedCodigoForUsers, setSelectedCodigoForUsers] = useState(null)
  const [registeredUsers, setRegisteredUsers] = useState([])
  const [loadingRegisteredUsers, setLoadingRegisteredUsers] = useState(false)
`;
content = content.replace("const [loadingCupones, setLoadingCupones] = useState(true)", "const [loadingCupones, setLoadingCupones] = useState(true)\n" + states_to_add);

// 2. UPDATE useEffect [user]
const use_effect_user_old = `  useEffect(() => {
    if (user) {
      fetchMisCupones()
    }
  }, [user])`;
const use_effect_user_new = `  useEffect(() => {
    if (user) {
      fetchMisCupones()
      fetchMisCodigosCreador()
      fetchMiCodigoUsado()
    }
  }, [user])`;
content = content.replace(use_effect_user_old, use_effect_user_new);

// 3. ADD FUNCTIONS
const functions_to_add = `
  const fetchMiCodigoUsado = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select(\`
          creador_codigo_id,
          codigos_creadores(codigo)
        \`)
        .eq('auth_user_id', user.id)
        .single()
        
      if (!error && data?.codigos_creadores) {
        setMiCodigoUsado(data.codigos_creadores.codigo)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchMisCodigosCreador = async () => {
    setLoadingCodigos(true)
    try {
      const { data, error } = await supabase
        .from('codigos_creadores')
        .select('*')
        .eq('usuario_id', user.id)
      
      if (error) throw error
      const codigos = data || []
      setMisCodigosCreador(codigos)
      
      if (codigos.length > 0) {
        fetchRecompensas(codigos.map(c => c.id))
      }
    } catch (err) {
      console.error('Error fetching codigos creador:', err)
    } finally {
      setLoadingCodigos(false)
    }
  }

  const fetchRecompensas = async (codigosIds) => {
    const { data: objData, error: objError } = await supabase
      .from('creador_objetivos')
      .select(\`
        *,
        p1:recompensa_1_valor_producto_id(id, nombre, precio_usd),
        p2:recompensa_2_valor_producto_id(id, nombre, precio_usd),
        p3:recompensa_3_valor_producto_id(id, nombre, precio_usd)
      \`)
      .order('meta_registros')
      
    if (objError) {
      console.error(objError)
      return
    }

    const { data: progData } = await supabase.rpc('get_creador_objetivos_progreso', {
      p_auth_user_id: user.id
    })
    
    let objParsed = objData || []
    if (progData) {
      objParsed = objParsed.map(o => {
        const pInfo = progData.find(p => p.objetivo_id === o.id)
        return {
          ...o,
          referidos_validos: pInfo ? pInfo.validos : 0
        }
      })
    }
    setObjetivos(objParsed)
    
    const { data: canjData } = await supabase.from('creador_recompensas_canjeadas').select('*').eq('creador_auth_id', user.id)
    if (canjData) setRecompensasCanjeadas(canjData)
  }

  const iniciarCanje = (objetivo, codigo) => {
    const opciones = []
    if ((objetivo.recompensa_1_tipo === 'producto' && objetivo.p1) || (objetivo.recompensa_1_tipo !== 'producto' && objetivo.recompensa_1_valor > 0)) opciones.push({ id: 1, tipo: objetivo.recompensa_1_tipo, valor: objetivo.recompensa_1_valor, p: objetivo.p1 })
    if ((objetivo.recompensa_2_tipo === 'producto' && objetivo.p2) || (objetivo.recompensa_2_tipo !== 'producto' && objetivo.recompensa_2_valor > 0)) opciones.push({ id: 2, tipo: objetivo.recompensa_2_tipo, valor: objetivo.recompensa_2_valor, p: objetivo.p2 })
    if ((objetivo.recompensa_3_tipo === 'producto' && objetivo.p3) || (objetivo.recompensa_3_tipo !== 'producto' && objetivo.recompensa_3_valor > 0)) opciones.push({ id: 3, tipo: objetivo.recompensa_3_tipo, valor: objetivo.recompensa_3_valor, p: objetivo.p3 })

    if (opciones.length === 1) {
      procesarCanje(objetivo, codigo, opciones[0])
    } else {
      setObjetivoToRedeem({ ...objetivo, opcionesParsed: opciones })
      setCodigoToRedeem(codigo)
      setShowSelectPremioModal(true)
    }
  }

  const procesarCanje = async (objetivo, codigo, opcionElegida) => {
    if (!window.confirm('¿Seguro que deseas canjear este premio?')) return
    setRedeemingObjetivoId(objetivo.id)
    try {
      let pedidoId = null;
      let productoElegidoId = null;
      
      if (opcionElegida.tipo === 'producto') {
        productoElegidoId = opcionElegida.p.id
        const { data: pedidoData, error: pedidoError } = await supabase.from('pedidos').insert([{
          cliente_id: user.id,
          estado: 'procesando',
          total_usd: 0,
          total_bs: 0
        }]).select().single()
        
        if (pedidoError) throw pedidoError
        pedidoId = pedidoData.id
        
        await supabase.from('pedido_items').insert([{
          pedido_id: pedidoId,
          producto_id: productoElegidoId,
          juego_nombre: 'Premio Creador',
          producto_nombre: opcionElegida.p.nombre,
          cantidad: 1,
          precio_usd: 0,
          precio_bs: 0
        }])
      } else {
        const moneda = opcionElegida.tipo === 'saldo_usd' ? 'usd' : 'bs'
        const { error: rpcError } = await supabase.rpc('recompensar_creador_billetera_rpc', {
          p_creador_auth_id: user.id,
          p_monto: opcionElegida.valor,
          p_moneda: moneda
        })
        if (rpcError) throw rpcError
      }

      const { error: canjeError } = await supabase.from('creador_recompensas_canjeadas').insert([{
        objetivo_id: objetivo.id,
        codigo_id: codigo.id,
        producto_elegido_id: productoElegidoId,
        pedido_id: pedidoId,
        tipo_recompensa_canjeada: opcionElegida.tipo,
        valor_recompensa_canjeada: opcionElegida.valor || 0
      }])
      
      if (canjeError) throw canjeError
      
      if (opcionElegida.tipo === 'producto') {
         setAlert({ type: 'success', message: \`¡Premio Canjeado! Se ha generado el pedido #\${pedidoId}.\` })
      } else {
         setAlert({ type: 'success', message: \`¡Premio Canjeado! Se han añadido \${opcionElegida.valor} \${opcionElegida.tipo === 'saldo_usd' ? 'USD' : 'Bs'} a tu billetera exitosamente.\` })
      }
      
      fetchRecompensas(misCodigosCreador.map(c => c.id))
      setShowSelectPremioModal(false)
      
    } catch (err) {
      console.error(err)
      setAlert({ type: 'error', message: 'Ocurrió un error al canjear el premio: ' + err.message })
    } finally {
      setRedeemingObjetivoId(null)
    }
  }

  const openRegisteredUsers = async (codigoId) => {
    setSelectedCodigoForUsers(codigoId)
    setShowUsersModal(true)
    setLoadingRegisteredUsers(true)
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nombres, apellidos, nickname, usuario, fecha_registro, compras_con_codigo_creador')
        .eq('creador_codigo_id', codigoId)
        .order('fecha_registro', { ascending: false })
      
      if (error) throw error
      setRegisteredUsers(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingRegisteredUsers(false)
    }
  }
`;
content = content.replace("  const fetchMisCupones = async () => {", functions_to_add + "\n  const fetchMisCupones = async () => {");

// 4. ADD miCodigoUsado UI
const mi_codigo_usado_ui = `              <div className="detail-item">
                <span className="label">País</span>
                <span className="value">{perfil?.pais || 'Venezuela'}</span>
              </div>
              {miCodigoUsado && (
                <div className="detail-item" style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                  <span className="label">Código Asociado</span>
                  <span className="value" style={{ color: 'var(--accent)' }}>{miCodigoUsado}</span>
                </div>
              )}
`;
content = content.replace(`              <div className="detail-item">
                <span className="label">País</span>
                <span className="value">{perfil?.pais || 'Venezuela'}</span>
              </div>`, mi_codigo_usado_ui);

// 5. ADD Mis Codigos Creador UI
const mis_codigos_creador_ui = `
            {/* Mis Códigos de Creador */}
            <div id="mis-codigos-creador" className="perfil-form-card" style={{ scrollMarginTop: '80px' }}>
              <h3><span className="icon">🌟</span> Mis Códigos de Creador</h3>
              {loadingCodigos ? (
                <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Cargando códigos...</div>
              ) : misCodigosCreador.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', backgroundColor: 'rgba(255, 215, 0, 0.05)', borderRadius: '12px', border: '1px solid rgba(255, 215, 0, 0.1)' }}>
                  <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>🌟</span>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>No tienes códigos de creador vinculados a tu cuenta.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                  {misCodigosCreador.map((c, i) => (
                    <div key={i} style={{ padding: '20px', borderRadius: '16px', background: 'var(--bg-hover)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 900, fontSize: '22px', color: 'var(--accent)', letterSpacing: '1px' }}>{c.codigo}</span>
                        <span style={{ fontWeight: 800, fontSize: '18px', color: '#00c853' }}>-{c.porcentaje_descuento}%</span>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                        <div style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: '10px', textAlign: 'center', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Usos Totales</div>
                          <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-main)' }}>{c.usos_totales}</div>
                        </div>
                        <div 
                          onClick={() => openRegisteredUsers(c.id)}
                          style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: '10px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid var(--border)' }}
                          onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                          onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                        >
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Registrados</div>
                          <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--accent)' }}>{c.usuarios_registrados}</div>
                          <div style={{ fontSize: '10px', color: '#00d2ff', marginTop: '2px' }}>Ver Lista 👀</div>
                        </div>
                      </div>
                      
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '4px' }}>
                        Estado: <span style={{ color: c.activo ? '#00c853' : '#ff5252', fontWeight: 'bold' }}>{c.activo ? 'Activo' : 'Inactivo'}</span>
                      </div>

                      {/* Objetivos del Creador */}
                      {objetivos.length > 0 && (
                        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                          <h4 style={{ fontSize: '14px', margin: '0 0 12px 0', color: 'var(--text-main)' }}>🏆 Metas y Premios</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {objetivos.filter(obj => obj.codigo_id === null || obj.codigo_id === c.id).map(obj => {
                              const canjeado = recompensasCanjeadas.find(rc => rc.objetivo_id === obj.id && rc.codigo_id === c.id)
                              const referidosValidos = obj.referidos_validos !== undefined ? obj.referidos_validos : c.usuarios_registrados
                              const progreso = Math.min((referidosValidos / obj.meta_registros) * 100, 100)
                              const alcanzado = referidosValidos >= obj.meta_registros
                              
                              return (
                                <div key={obj.id} style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '12px', border: '1px solid var(--border)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Meta: {obj.meta_registros} ref</span>
                                      {obj.compras_minimas_usuario > 0 && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Mín. compras: {obj.compras_minimas_usuario}</span>}
                                    </div>
                                    {canjeado ? (
                                      <span style={{ fontSize: '11px', background: 'rgba(0, 200, 83, 0.1)', color: '#00c853', padding: '2px 8px', borderRadius: '8px', fontWeight: 'bold' }}>✓ RECLAMADO</span>
                                    ) : alcanzado ? (
                                      <button 
                                        onClick={() => iniciarCanje(obj, c)}
                                        disabled={redeemingObjetivoId === obj.id}
                                        style={{ background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)', border: 'none', padding: '4px 12px', fontSize: '12px', fontWeight: 'bold', color: 'white', borderRadius: '8px', cursor: 'pointer' }}
                                      >
                                        {redeemingObjetivoId === obj.id ? '...' : '🎁 CANJEAR'}
                                      </button>
                                    ) : (
                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{referidosValidos} / {obj.meta_registros}</span>
                                    )}
                                  </div>
                                  
                                  {/* Barra de progreso */}
                                  {!canjeado && (
                                    <div style={{ width: '100%', height: '6px', background: 'var(--bg-hover)', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                                      <div style={{ height: '100%', width: \`\${progreso}%\`, background: alcanzado ? '#00c853' : 'var(--accent)', transition: 'width 0.5s ease' }}></div>
                                    </div>
                                  )}

                                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                    {obj.recompensa_1_tipo === 'producto' && obj.p1 && <div style={{ fontSize: '11px', background: 'var(--bg-hover)', padding: '2px 8px', borderRadius: '8px' }}>🎁 {obj.p1.nombre}</div>}
                                    {obj.recompensa_1_tipo === 'saldo_usd' && <div style={{ fontSize: '11px', background: 'var(--bg-hover)', padding: '2px 8px', borderRadius: '8px' }}>🎁 $\${obj.recompensa_1_valor}</div>}
                                    {obj.recompensa_1_tipo === 'saldo_bs' && <div style={{ fontSize: '11px', background: 'var(--bg-hover)', padding: '2px 8px', borderRadius: '8px' }}>🎁 {obj.recompensa_1_valor} Bs</div>}
                                    
                                    {((obj.recompensa_2_tipo === 'producto' && obj.p2) || (obj.recompensa_2_tipo !== 'producto' && obj.recompensa_2_valor > 0)) && (
                                      <div style={{ fontSize: '11px', background: 'var(--bg-hover)', padding: '2px 8px', borderRadius: '8px' }}>
                                        {obj.recompensa_2_tipo === 'producto' ? \`🎁 \${obj.p2?.nombre}\` : obj.recompensa_2_tipo === 'saldo_usd' ? \`🎁 $\${obj.recompensa_2_valor}\` : \`🎁 \${obj.recompensa_2_valor} Bs\`}
                                      </div>
                                    )}
                                    
                                    {((obj.recompensa_3_tipo === 'producto' && obj.p3) || (obj.recompensa_3_tipo !== 'producto' && obj.recompensa_3_valor > 0)) && (
                                      <div style={{ fontSize: '11px', background: 'var(--bg-hover)', padding: '2px 8px', borderRadius: '8px' }}>
                                        {obj.recompensa_3_tipo === 'producto' ? \`🎁 \${obj.p3?.nombre}\` : obj.recompensa_3_tipo === 'saldo_usd' ? \`🎁 $\${obj.recompensa_3_valor}\` : \`🎁 \${obj.recompensa_3_valor} Bs\`}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
`;
content = content.replace("          </div>\n         </div>", mis_codigos_creador_ui + "          </div>\n         </div>");

// 6. ADD MODALS
const modals_ui = `
      {/* Modal Seleccionar Premio Múltiple */}
      {showSelectPremioModal && objetivoToRedeem && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowSelectPremioModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ 
            maxWidth: '500px', width: '95%', padding: '30px', borderRadius: '24px', 
            background: 'var(--bg-card)', border: '1px solid var(--border)', 
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '20px'
          }}>
            <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 900, textAlign: 'center' }}>🎉 ¡Felicidades! 🎉</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', textAlign: 'center', fontSize: '15px' }}>
              Has alcanzado tu meta de {objetivoToRedeem.meta_registros} referidos. 
              Selecciona cuál de las siguientes recompensas deseas recibir:
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {objetivoToRedeem.opcionesParsed?.map((opc, i) => (
                <button 
                  key={i}
                  onClick={() => procesarCanje(objetivoToRedeem, codigoToRedeem, opc)}
                  style={{ 
                    padding: '16px', background: 'var(--bg-hover)', border: '1px solid var(--border)', 
                    borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'left',
                    transition: 'all 0.2s ease', cursor: 'pointer', color: 'var(--text-main)'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  <div style={{ fontSize: '24px' }}>🎁</div>
                  <div style={{ fontWeight: 800, fontSize: '15px' }}>
                    {opc.tipo === 'producto' ? opc.p.nombre : opc.tipo === 'saldo_usd' ? \`$\${opc.valor} USD\` : \`\${opc.valor} Bs\`}
                  </div>
                </button>
              ))}
            </div>
            
            <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setShowSelectPremioModal(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Modal Usuarios Registrados */}
      {showUsersModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowUsersModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ 
            maxWidth: '500px', width: '95%', padding: '30px', borderRadius: '24px', 
            background: 'var(--bg-card)', border: '1px solid var(--border)', 
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', maxHeight: '80vh'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 900 }}>👥 Usuarios Registrados</h3>
              <button onClick={() => setShowUsersModal(false)} style={{ fontSize: '24px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>×</button>
            </div>
            
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {loadingRegisteredUsers ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Cargando usuarios...</div>
              ) : registeredUsers.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Aún no hay usuarios registrados con este código.</div>
              ) : (
                registeredUsers.map(u => (
                  <div key={u.id} style={{ background: 'var(--bg-hover)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '14px' }}>{u.nombres} {u.apellidos} {u.nickname ? \`(\${u.nickname})\` : ''}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{u.usuario}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Registrado: {new Date(u.fecha_registro).toLocaleDateString()}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Compras</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#00d2ff' }}>{u.compras_con_codigo_creador}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
`;
content = content.replace("      {imageToCrop && (", modals_ui + "      {imageToCrop && (");

fs.writeFileSync('c:\\hulk\\app\\src\\components\\LandingPerfil.jsx', content, 'utf-8');
