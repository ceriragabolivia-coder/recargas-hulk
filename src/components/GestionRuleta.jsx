import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatUSD, formatBs } from '../utils/helpers'
import { useAuth } from '../hooks/useData'

const COLORS_PRESET = ['#FF6B6B','#FF8E53','#FFCA28','#66BB6A','#26C6DA','#5C6BC0','#AB47BC','#EC407A','#FF7043','#26A69A']
const TIPOS = [
  { value: 'saldo_usd',   label: '💵 Saldo USD (Billetera)', hasValue: true },
  { value: 'saldo_bs',   label: '💜 Saldo Bs (Billetera)',  hasValue: true },
  { value: 'descuento',  label: '🎟️ Descuento (%)',          hasValue: true },
  { value: 'mensaje',    label: '🎁 Premio Especial / Mensaje', hasValue: false },
  { value: 'sin_premio', label: '😢 Sin Premio',               hasValue: false },
]
const EMOJIS = ['🎁','💰','⭐','🏆','💎','🎉','🎊','🌟','🔥','💥','🍀','🎯','🥇','🎀']

const EMPTY_FORM = { nombre: '', descripcion: '', tipo: 'mensaje', valor: '', probabilidad: 10, color: '#FF6B6B', emoji: '🎁', activo: true }

export default function GestionRuleta() {
  const [tab, setTab]               = useState('premios')
  const [premios, setPremios]       = useState([])
  const [historial, setHistorial]   = useState([])
  const [usuarios, setUsuarios]     = useState([])
  const [allClients, setAllClients] = useState([])
  const [config, setConfig]         = useState({ ruleta_activa: 'true', ruleta_titulo: '¡Gira y Gana!', ruleta_descripcion: '' })
  const [form, setForm]             = useState(EMPTY_FORM)
  const [editing, setEditing]       = useState(null)
  const [showForm, setShowForm]     = useState(false)
  const [showGift, setShowGift]     = useState(false)
  const [giftTarget, setGiftTarget] = useState('')
  const [giftAmount, setGiftAmount] = useState(1)
  const [giftSearch, setGiftSearch] = useState('')
  const [saving, setSaving]         = useState(false)
  const [loadingTab, setLoadingTab] = useState(false)
  const [giroInput, setGiroInput]   = useState({})
  const [tabGift, setTabGift]       = useState('individual')
  const [giftPremioId, setGiftPremioId] = useState('')

  const { perfil: adminPerfil } = useAuth()

  useEffect(() => { 
    fetchPremios()
    fetchConfig()
    fetchAllClients() 
  }, [])

  useEffect(() => {
    if (tab === 'historial') fetchHistorial()
    if (tab === 'usuarios')  fetchUsuarios()
  }, [tab])

  // ── Fetch ────────────────────────────────────────────────────
  const fetchPremios = async () => {
    const { data } = await supabase.from('ruleta_premios').select('*').order('created_at')
    setPremios(data || [])
  }

  const fetchAllClients = async () => {
    // 1. Cargamos de la tabla 'clientes' (usando 'usuario' que es el correo real)
    const { data: list, error: listError } = await supabase
      .from('clientes')
      .select('auth_user_id, usuario, nombres')
      .limit(800)

    if (listError) {
      alert("❌ Error cargando clientes para buscador: " + listError.message)
      return
    }

    if (!list || list.length === 0) {
      setAllClients([])
      return
    }

    // 2. Traemos perfiles para filtrar por rol
    const { data: perfs } = await supabase
      .from('perfiles')
      .select('id, rol')
      .in('id', list.map(c => c.auth_user_id).filter(Boolean))

    const perfilesMap = {}
    ;(perfs || []).forEach(p => { perfilesMap[p.id] = p.rol })

    const formatted = list.map(c => ({
      id: c.auth_user_id, 
      email: c.usuario || '', 
      nombre: c.nombres || '',
      rol: perfilesMap[c.auth_user_id] || 'cliente'
    })).filter(u => {
      const r = (u.rol || '').toLowerCase()
      return r === 'cliente' || r === 'revendedor'
    })

    console.log("👥 Usuarios cargados exitosamente:", formatted.length)
    setAllClients(formatted)
  }

  const fetchConfig = async () => {
    const { data, error } = await supabase
      .from('configuracion')
      .select('clave, valor, valor_texto')
      .ilike('clave', 'ruleta_%')

    if (error) return

    const newConfig = { ruleta_activa: 'false', ruleta_titulo: '¡Gira y Gana!', ruleta_descripcion: '' }
    if (data) {
      data.forEach(row => {
        if (row.clave === 'ruleta_activa') newConfig.ruleta_activa = (row.valor === 1 || row.valor === '1').toString()
        if (row.clave === 'ruleta_titulo') newConfig.ruleta_titulo = row.valor_texto || ''
        if (row.clave === 'ruleta_descripcion') newConfig.ruleta_descripcion = row.valor_texto || ''
      })
    }
    setConfig(newConfig)
  }

  const saveConfig = async () => {
    setSaving(true)
    const updates = [
      { clave: 'ruleta_activa', valor: config.ruleta_activa === 'true' ? 1 : 0 },
      { clave: 'ruleta_titulo', valor_texto: config.ruleta_titulo },
      { clave: 'ruleta_descripcion', valor_texto: config.ruleta_descripcion }
    ]
    for (const item of updates) {
      await supabase.from('configuracion').update(item).eq('clave', item.clave)
    }
    setSaving(false)
    alert('✅ Configuración guardada')
  }

  const fetchHistorial = async () => {
    setLoadingTab(true)
    const { data: h } = await supabase
      .from('ruleta_giros')
      .select('id,premio_nombre,tipo,valor,acreditado,created_at,cliente_id')
      .order('created_at', { ascending: false })
      .limit(100)
    setHistorial(h || [])
    setLoadingTab(false)
  }

  const fetchUsuarios = async () => {
    setLoadingTab(true)
    const { data } = await supabase
      .from('ruleta_giros_disponibles')
      .select('cliente_id,giros_disponibles,total_ganados,updated_at')
      .order('giros_disponibles', { ascending: false })
    
    const ids = (data || []).map(d => d.cliente_id)
    let emailMap = {}
    if (ids.length > 0) {
      const { data: perfs } = await supabase.from('perfiles').select('id,email').in('id', ids)
      ;(perfs || []).forEach(p => { emailMap[p.id] = p.email })
    }
    setUsuarios((data || []).map(d => ({ ...d, email: emailMap[d.cliente_id] || d.cliente_id.slice(0,8) + '…' })))
    setLoadingTab(false)
  }

  // ── Actions ─────────────────────────────────────────────
  const savePremio = async () => {
    setSaving(true)
    const payload = { ...form, valor: Number(form.valor) || 0, probabilidad: Number(form.probabilidad) || 1 }
    if (editing) await supabase.from('ruleta_premios').update(payload).eq('id', editing)
    else await supabase.from('ruleta_premios').insert(payload)
    await fetchPremios()
    setShowForm(false)
    setSaving(false)
  }

  const toggleActivo = async (p) => {
    await supabase.from('ruleta_premios').update({ activo: !p.activo }).eq('id', p.id)
    fetchPremios()
  }

  const asignarGirosToUser = async (clienteId, cantidad) => {
    if (!clienteId || cantidad < 1) return false
    const { data: existing } = await supabase.from('ruleta_giros_disponibles').select('giros_disponibles,total_ganados').eq('cliente_id', clienteId).maybeSingle()
    if (existing) {
      await supabase.from('ruleta_giros_disponibles').update({
        giros_disponibles: existing.giros_disponibles + cantidad,
        total_ganados: existing.total_ganados + cantidad,
        updated_at: new Date().toISOString()
      }).eq('cliente_id', clienteId)
    } else {
      await supabase.from('ruleta_giros_disponibles').insert({ cliente_id: clienteId, giros_disponibles: cantidad, total_ganados: cantidad })
    }
    return true
  }

  const tabStyle = (id) => ({
    padding: '10px 20px', borderRadius: 12, border: 'none',
    background: tab === id ? 'var(--accent-primary)' : 'rgba(255,255,255,.05)',
    color: tab === id ? '#fff' : 'var(--text-muted)',
    fontWeight: 700, cursor: 'pointer', transition: 'all .2s'
  })

  return (
    <div style={{ padding: '20px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🎡</div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Gestión de Ruleta</h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Configura premios y regala giros</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 32, background: 'rgba(255,255,255,.03)', padding: 6, borderRadius: 16, width: 'fit-content' }}>
        <button onClick={() => setTab('premios')} style={tabStyle('premios')}>🎡 Premios</button>
        <button onClick={() => setTab('usuarios')} style={tabStyle('usuarios')}>👤 Usuarios</button>
        <button onClick={() => setTab('historial')} style={tabStyle('historial')}>📜 Historial</button>
        <button onClick={() => setTab('config')} style={tabStyle('config')}>⚙️ Config</button>
      </div>

      {tab === 'premios' && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
             <span style={{ color:'var(--text-muted)' }}>{premios.filter(p=>p.activo).length} premios activos</span>
             <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => setShowGift(true)} className="btn" style={{ background:'rgba(168,85,247,.15)', color:'#c084fc', border:'1px solid rgba(168,85,247,.3)' }}>🎁 Regalar</button>
                <button onClick={() => { setForm(EMPTY_FORM); setEditing(null); setShowForm(true) }} className="btn btn-primary">+ Agregar</button>
             </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {premios.map(p => (
              <div key={p.id} className="card" style={{ padding:20, display:'flex', alignItems:'center', gap:20, borderLeft:`6px solid ${p.color}`, opacity: p.activo?1:0.5 }}>
                <div style={{ fontSize:32 }}>{p.emoji}</div>
                <div style={{ flex:1 }}>
                  <h4 style={{ fontWeight:900 }}>{p.nombre}</h4>
                  <div style={{ fontSize:12, color:'var(--text-muted)' }}>{TIPOS.find(t=>t.value===p.tipo)?.label} | {p.valor} | Prob: {p.probabilidad}%</div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => toggleActivo(p)} className="btn btn-sm">{p.activo?'⏸':'▶️'}</button>
                  <button onClick={() => { setForm(p); setEditing(p.id); setShowForm(true) }} className="btn btn-sm">✏️</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'usuarios' && (
        <div className="card" style={{ padding:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead style={{ background:'rgba(255,255,255,.03)' }}>
              <tr><th style={{ padding:16, textAlign:'left' }}>Usuario</th><th style={{ textAlign:'center' }}>Giros</th><th style={{ textAlign:'right' }}>Acción</th></tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.cliente_id} style={{ borderBottom:'1px solid rgba(255,255,255,.05)' }}>
                  <td style={{ padding:16 }}>{u.email} <br/><small style={{ color:'var(--text-muted)' }}>{u.cliente_id.slice(0,8)}</small></td>
                  <td style={{ textAlign:'center' }}>{u.giros_disponibles}</td>
                  <td style={{ textAlign:'right', padding:16 }}>
                    <input type="number" value={giroInput[u.cliente_id] || ''} onChange={e=>setGiroInput(p=>({...p, [u.cliente_id]: e.target.value}))} style={{ width:50, marginRight:8 }} />
                    <button onClick={async () => { await asignarGirosToUser(u.cliente_id, parseInt(giroInput[u.cliente_id])); setGiroInput(p=>({...p, [u.cliente_id]:''})); fetchUsuarios() }} className="btn btn-sm">+ Add</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'historial' && (
        <div className="card" style={{ padding:0 }}>
          <table style={{ width:'100%' }}>
            <tbody>
              {historial.map(h => (
                <tr key={h.id} style={{ borderBottom:'1px solid rgba(255,255,255,.05)' }}>
                  <td style={{ padding:12 }}>{new Date(h.created_at).toLocaleDateString()}</td>
                  <td>{h.cliente_id.slice(0,8)}</td>
                  <td>{h.premio_nombre}</td>
                  <td style={{ textAlign:'right' }}>{h.acreditado ? '✅' : '❌'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'config' && (
        <div className="card" style={{ padding:28, maxWidth:500 }}>
          <h3 style={{ marginBottom:20 }}>⚙️ Configuración</h3>
          <div className="form-group" style={{ marginBottom:16 }}>
            <label className="form-label">Estado</label>
            <div style={{ display:'flex', gap:10 }}>
              {[['true','Activa'],['false','Desact.']].map(([v,l])=>(
                <button key={v} onClick={()=>setConfig(p=>({...p,ruleta_activa:v}))} style={{ flex:1, padding:10, borderRadius:10, border:`2px solid ${config.ruleta_activa===v?'var(--accent-primary)':'transparent'}`, background:'rgba(255,255,255,.05)', color:config.ruleta_activa===v?'var(--accent-primary)':'#fff', cursor:'pointer' }}>{l}</button>
              ))}
            </div>
          </div>
          <div className="form-group" style={{ marginBottom:16 }}>
            <label className="form-label">Título</label>
            <input className="form-input" value={config.ruleta_titulo} onChange={e=>setConfig(p=>({...p,ruleta_titulo:e.target.value}))} />
          </div>
          <div className="form-group" style={{ marginBottom:20 }}>
            <label className="form-label">Descripción</label>
            <textarea className="form-input" value={config.ruleta_descripcion} onChange={e=>setConfig(p=>({...p,ruleta_descripcion:e.target.value}))} />
          </div>
          <button className="btn btn-primary" style={{ width:'100%' }} disabled={saving} onClick={saveConfig}>💾 Guardar</button>
        </div>
      )}

      {showGift && (
        <div style={{ position:'fixed', inset:0, zIndex:50000, background:'rgba(0,0,0,.8)', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setShowGift(false)}>
          <div className="card" style={{ width:400, padding:24 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom:20 }}>🎁 Regalar</h3>
            <div style={{ display:'flex', gap:8, marginBottom:20 }}>
              <button onClick={()=>setTabGift('individual')} style={{ flex:1, padding:8, background:tabGift==='individual'?'#a855f7':'none', color:'#fff', border:'1px solid #fff', borderRadius:8 }}>Individual</button>
              <button onClick={()=>setTabGift('masivo')} style={{ flex:1, padding:8, background:tabGift==='masivo'?'#a855f7':'none', color:'#fff', border:'1px solid #fff', borderRadius:8 }}>Masivo</button>
            </div>
            {tabGift === 'individual' ? (
              <>
                <input className="form-input" placeholder="Buscar..." value={giftSearch} onChange={e=>setGiftSearch(e.target.value)} style={{ marginBottom:10 }} />
                <div style={{ maxHeight:200, overflowY:'auto' }}>
                  {allClients.filter(c => c.email.toLowerCase().includes(giftSearch.toLowerCase())).map(c => (
                    <button key={c.id} onClick={()=>setGiftTarget(c.id)} style={{ width:'100%', padding:10, textAlign:'left', background: giftTarget===c.id?'#a855f7':'none', border:'none', color:'#fff', borderRadius:6 }}>{c.nombre || c.email}</button>
                  ))}
                </div>
              </>
            ) : (
              <select className="form-input" value={giftPremioId} onChange={e=>setGiftPremioId(e.target.value)}>
                <option value="">Premio masivo...</option>
                {premios.filter(p=>p.activo).map(p=>(<option key={p.id} value={p.id}>{p.emoji} {p.nombre}</option>))}
              </select>
            )}
            <button className="btn btn-primary" style={{ width:'100%', marginTop:20 }} disabled={saving} onClick={async ()=>{
              setSaving(true)
              if (tabGift==='masivo') {
                const { error } = await supabase.rpc('regalar_premio_masivo', { p_premio_id: giftPremioId, p_admin_id: adminPerfil?.id })
                if (error) alert(error.message.includes('404') ? 'Ejecuta el SQL 039' : error.message)
                else alert('Enviado!')
              } else {
                await asignarGirosToUser(giftTarget, giftAmount)
                alert('Regalado!')
              }
              setSaving(false); setShowGift(false)
            }}>Enviar</button>
          </div>
        </div>
      )}

      {showForm && (
        <div style={{ position:'fixed', inset:0, zIndex:50000, background:'rgba(0,0,0,.8)', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setShowForm(false)}>
           <div className="card" style={{ width:400, padding:24 }} onClick={e => e.stopPropagation()}>
              <h3 style={{ marginBottom:20 }}>{editing?'Editar':'Nuevo'} Premio</h3>
              <input className="form-input" placeholder="Nombre" value={form.nombre} onChange={e=>setForm({...form, nombre:e.target.value})} style={{ marginBottom:12 }} />
              <select className="form-input" value={form.tipo} onChange={e=>setForm({...form, tipo:e.target.value})} style={{ marginBottom:12 }}>
                {TIPOS.map(t=>(<option key={t.value} value={t.value}>{t.label}</option>))}
              </select>
              <input className="form-input" type="number" placeholder="Valor" value={form.valor} onChange={e=>setForm({...form, valor:e.target.value})} style={{ marginBottom:12 }} />
              <button className="btn btn-primary" style={{ width:'100%' }} onClick={savePremio}>Guardar</button>
           </div>
        </div>
      )}
    </div>
  )
}
