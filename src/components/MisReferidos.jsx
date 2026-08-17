import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useData'
import AlertModal from './AlertModal'

export default function MisReferidos() {
  const { user, perfil } = useAuth()
  const [codigo, setCodigo] = useState(null)
  const [referidos, setReferidos] = useState([])
  const [objetivos, setObjetivos] = useState([])
  const [canjeadas, setCanjeadas] = useState([])
  const [loading, setLoading] = useState(true)
  const [alertMsg, setAlertMsg] = useState(null)

  useEffect(() => {
    if (user?.id) {
      fetchData()
    }
  }, [user?.id])

  const fetchData = async () => {
    setLoading(true)
    try {
      // 1. Obtener mi código de referido
      const { data: myData } = await supabase
        .from('clientes')
        .select('codigo_referido_propio, id')
        .eq('auth_user_id', user.id)
        .single()
      
      const myId = myData?.id
      if (myData?.codigo_referido_propio) {
        setCodigo(myData.codigo_referido_propio)
      }

      // 2. Obtener lista de usuarios referidos por mí
      if (myId) {
        const { data: refData } = await supabase
          .from('clientes')
          .select('id, nombres, apellidos, usuario, nickname, fecha_registro, pedidos(estado)')
          .eq('referido_por_cliente_id', myId)
          .order('fecha_registro', { ascending: false })
          
        if (refData) {
          const procesados = refData.map(r => {
            const comprasCompletadas = r.pedidos?.filter(p => p.estado === 'completado').length || 0;
            return {
              id: r.id,
              nombres: r.nombres,
              apellidos: r.apellidos,
              usuario: r.usuario,
              nickname: r.nickname,
              fecha_registro: r.fecha_registro,
              compras: comprasCompletadas
            }
          })
          setReferidos(procesados)
        }
      }

      // 3. Obtener objetivos
      const { data: objData } = await supabase
        .from('referidos_objetivos')
        .select('*')
        .eq('estado', true)
        .order('meta_registros_activos', { ascending: true })
      
      if (objData) setObjetivos(objData)

      // 4. Obtener canjeadas
      if (myId) {
        const { data: canjData } = await supabase
          .from('referidos_recompensas_canjeadas')
          .select('objetivo_id')
          .eq('cliente_id', myId)
        
        if (canjData) setCanjeadas(canjData.map(c => c.objetivo_id))
      }

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (!codigo) return
    const link = `${window.location.origin}/?ref=${codigo}`
    navigator.clipboard.writeText(link)
    setAlertMsg({ type: 'success', title: '¡Copiado!', message: 'Link de referido copiado al portapapeles.' })
  }

  const handleClaim = async (objetivo) => {
    try {
      const { data: myData } = await supabase.from('clientes').select('id').eq('auth_user_id', user.id).single()
      if (!myData) throw new Error('Cliente no encontrado')
      
      const { error } = await supabase.rpc('reclamar_recompensa_referido', {
        p_cliente_id: myData.id,
        p_objetivo_id: objetivo.id
      })
      
      if (error) throw error
      
      setAlertMsg({ type: 'success', title: '¡Felicidades!', message: 'Recompensa reclamada con éxito.' })
      fetchData()
    } catch (err) {
      setAlertMsg({ type: 'error', title: 'Error', message: err.message || 'No se pudo reclamar la recompensa.' })
    }
  }

  // Filtrar referidos válidos (que cumplen compras mínimas)
  const getReferidosValidos = (minCompras) => {
    return referidos.filter(r => r.compras >= minCompras).length
  }

  if (loading) return <div style={{ color: '#fff' }}>Cargando sistema de referidos...</div>

  return (
    <div className="mis-referidos-container" style={{ color: '#fff' }}>
      <h3 style={{ marginBottom: '1rem', color: '#00e5ff' }}>Mi Sistema de Referidos</h3>
      
      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '12px', marginBottom: '2rem' }}>
        <h4 style={{ marginBottom: '0.5rem' }}>Tu Link de Invitación</h4>
        <p style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '1rem' }}>
          Comparte este link con tus amigos. Cuando se registren y realicen compras, acumularás progreso para reclamar recompensas.
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            readOnly 
            value={codigo ? `${window.location.origin}/?ref=${codigo}` : 'Generando...'} 
            style={{ flex: '1 1 200px', minWidth: 0, padding: '10px', borderRadius: '8px', border: '1px solid #333', background: '#000', color: '#00e5ff' }}
          />
          <button onClick={handleCopy} className="btn-primary" style={{ padding: '10px 20px', borderRadius: '8px', flexShrink: 0, whiteSpace: 'nowrap' }}>
            Copiar
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h4 style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Objetivos y Recompensas</h4>
        {objetivos.length === 0 ? (
          <p style={{ color: '#aaa', fontStyle: 'italic' }}>No hay objetivos disponibles actualmente.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '15px' }}>
            {objetivos.map(obj => {
              const validos = getReferidosValidos(obj.compras_minimas_usuario)
              const meta = obj.meta_registros_activos
              const progress = Math.min((validos / meta) * 100, 100)
              const yaCanjeado = canjeadas.includes(obj.id)
              const canClaim = validos >= meta && !yaCanjeado
              
              let descRecompensa = ''
              if (obj.recompensa_tipo === 'saldo_bs') descRecompensa = `Saldo Bs. ${obj.recompensa_valor}`
              else if (obj.recompensa_tipo === 'saldo_usd') descRecompensa = `Saldo $${obj.recompensa_valor}`
              else descRecompensa = 'Producto Sorpresa'

              return (
                <div key={obj.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid #222', borderRadius: '10px', padding: '1rem' }}>
                  <h5 style={{ color: '#ffb300', marginBottom: '0.5rem' }}>Invita a {meta} Amigos</h5>
                  <p style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '0.5rem' }}>Tus amigos deben realizar al menos {obj.compras_minimas_usuario} compra(s).</p>
                  
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '5px' }}>
                      <span>Usuarios Registrados: {referidos.length}/{meta}</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min((referidos.length / meta) * 100, 100)}%`, height: '100%', background: '#9c27b0', transition: 'width 0.3s ease' }}></div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '5px' }}>
                      <span>Usuarios con compras: {validos}/{meta}</span>
                      <span style={{ color: '#00e5ff', fontWeight: 'bold' }}>Premio: {descRecompensa}</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${progress}%`, height: '100%', background: canClaim ? '#00e5ff' : '#00b0ff', transition: 'width 0.3s ease' }}></div>
                    </div>
                  </div>

                  <button 
                    disabled={!canClaim || yaCanjeado}
                    onClick={() => handleClaim(obj)}
                    style={{
                      width: '100%', padding: '8px', borderRadius: '6px', border: 'none', cursor: (!canClaim || yaCanjeado) ? 'not-allowed' : 'pointer',
                      background: yaCanjeado ? '#333' : (canClaim ? '#00e5ff' : '#444'),
                      color: yaCanjeado ? '#888' : (canClaim ? '#000' : '#888'),
                      fontWeight: 'bold'
                    }}
                  >
                    {yaCanjeado ? 'Reclamado' : (canClaim ? 'Reclamar Premio' : 'Incompleto')}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <h4 style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Historial de Referidos</h4>
        {referidos.length === 0 ? (
          <p style={{ color: '#aaa', fontStyle: 'italic' }}>Aún no has invitado a nadie.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #333' }}>Usuario</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #333' }}>Fecha Registro</th>
                  <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #333' }}>Compras Completadas</th>
                </tr>
              </thead>
              <tbody>
                {referidos.map(r => (
                  <tr key={r.id}>
                    <td style={{ padding: '10px', borderBottom: '1px solid #222' }}>
                      {r.nombres} {r.apellidos?.charAt(0) ? r.apellidos.charAt(0) + '.' : ''} 
                      {(!r.nombres && r.nickname) ? r.nickname : ''}
                      {(!r.nombres && !r.nickname) ? r.usuario.split('@')[0] : ''}
                    </td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #222' }}>{new Date(r.fecha_registro).toLocaleDateString()}</td>
                    <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #222' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '12px', background: r.compras > 0 ? 'rgba(0, 229, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)', color: r.compras > 0 ? '#00e5ff' : '#aaa' }}>
                        {r.compras}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {alertMsg && (
        <AlertModal
          type={alertMsg.type}
          title={alertMsg.title}
          message={alertMsg.message}
          onClose={() => setAlertMsg(null)}
        />
      )}
    </div>
  )
}
