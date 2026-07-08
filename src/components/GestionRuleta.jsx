import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatUSD, formatBs } from '../utils/helpers'
import { useAuth } from '../hooks/useData'

const COLORS_PRESET = ['#a855f7','#7c3aed','#3b82f6','#2563eb','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#8b5cf6']
const TIPOS = [
  { value: 'saldo_usd',   label: '💵 Saldo USD (Billetera)', emoji:'💵' },
  { value: 'saldo_bs',   label: '💜 Saldo Bs (Billetera)',  emoji:'💜' },
  { value: 'descuento',  label: '🎟️ Descuento (%)',          emoji:'🎟️' },
  { value: 'mensaje',    label: '🎁 Premio Especial / Mensaje', emoji:'🎁' },
  { value: 'sin_premio', label: '😢 Sin Premio',               emoji:'😢' },
]

const EMPTY_FORM = { nombre: '', descripcion: '', tipo: 'mensaje', valor: '', probabilidad: 10, color: '#a855f7', emoji: '🎁', activo: true }

export default function GestionRuleta() {
  const { perfil: adminPerfil } = useAuth()
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
  
  // Gifting States
  const [tabGift, setTabGift]       = useState('individual')
  const [giftTarget, setGiftTarget] = useState('')
  const [giftMode, setGiftMode]     = useState('giros') // 'giros' | 'premio'
  const [giftAmount, setGiftAmount] = useState(1)
  const [giftPremioId, setGiftPremioId] = useState('')
  const [giftSearch, setGiftSearch] = useState('')
  
  const [saving, setSaving]         = useState(false)
  const [loadingTab, setLoadingTab] = useState(false)
  const [giroInput, setGiroInput]   = useState({})

  useEffect(() => { 
    fetchPremios()
    fetchConfig()
    fetchAllClients() 
  }, [])

  useEffect(() => {
    if (tab === 'historial') fetchHistorial()
    if (tab === 'usuarios')  fetchUsuarios()
  }, [tab])

  // ── Data Fetching ────────────────────────────────────────────────────
  const fetchPremios = async () => {
    const { data } = await supabase.from('ruleta_premios').select('*').order('created_at')
    setPremios(data || [])
  }

  const fetchAllClients = async () => {
    const { data: list, error: listError } = await supabase
      .from('clientes')
      .select('auth_user_id, usuario, nombres')
      .limit(1000)

    if (listError) {
      console.error("❌ Error fetchAllClients:", listError)
      return
    }

    const { data: perfs } = await supabase.from('perfiles').select('id, rol')
    const perfilesMap = {}
    ;(perfs || []).forEach(p => { perfilesMap[p.id] = p.rol })

    const formatted = (list || []).map(c => ({
      id: c.auth_user_id, 
      email: c.usuario || '', 
      nombre: c.nombres || '',
      rol: perfilesMap[c.auth_user_id] || 'cliente'
    })).filter(u => {
      const r = (u.rol || '').toLowerCase()
      return r === 'cliente'
    })
    setAllClients(formatted)
  }

  const fetchConfig = async () => {
    const { data } = await supabase.from('configuracion').select('clave, valor, valor_texto').ilike('clave', 'ruleta_%')
    const newConfig = { ruleta_activa: 'true', ruleta_titulo: '¡Gira y Gana!', ruleta_descripcion: '' }
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
    try {
      const updates = [
        { clave: 'ruleta_activa', valor: config.ruleta_activa === 'true' ? 1 : 0, descripcion: 'Estado de la Ruleta' },
        { clave: 'ruleta_titulo', valor_texto: config.ruleta_titulo, valor: 0, descripcion: 'Título de la Ruleta' },
        { clave: 'ruleta_descripcion', valor_texto: config.ruleta_descripcion, valor: 0, descripcion: 'Descripción de la Ruleta' }
      ]
      
      for (const item of updates) {
        const { error } = await supabase
          .from('configuracion')
          .update(item)
          .eq('clave', item.clave)
        
        if (error) {
          // Si falla la actualización, intentamos insertarlo (por si no existía)
          await supabase.from('configuracion').insert(item)
        }
      }
      
      alert('✅ Configuración guardada correctamente')
    } catch (err) {
      console.error("Error saveConfig:", err)
      alert('❌ Error al guardar configuración: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const fetchHistorial = async () => {
    setLoadingTab(true)
    const { data: h } = await supabase.from('ruleta_giros').select('*').order('created_at', { ascending: false }).limit(100)
    setHistorial(h || [])
    setLoadingTab(false)
  }

  const fetchUsuarios = async () => {
    setLoadingTab(true)
    const { data } = await supabase.from('ruleta_giros_disponibles').select('*').order('giros_disponibles', { ascending: false })
    const { data: listCli } = await supabase.from('clientes').select('auth_user_id,usuario,nombres')
    const cliMap = {}
    ;(listCli || []).forEach(c => cliMap[c.auth_user_id] = c.usuario || c.nombres)
    setUsuarios((data || []).map(d => ({ ...d, email: cliMap[d.cliente_id] || d.cliente_id.slice(0,8) + '…' })))
    setLoadingTab(false)
  }

  // ── Actions ─────────────────────────────────────────────────────────
  const savePremio = async () => {
    setSaving(true)
    try {
      // Limpiar payload de campos internos de Supabase
      const { id, created_at, ...cleanForm } = form
      const payload = { 
        ...cleanForm, 
        valor: Number(form.valor) || 0, 
        probabilidad: Number(form.probabilidad) || 1 
      }

      let result
      if (editing) {
        result = await supabase.from('ruleta_premios').update(payload).eq('id', editing)
      } else {
        result = await supabase.from('ruleta_premios').insert(payload)
      }

      if (result.error) throw result.error
      
      await fetchPremios()
      setShowForm(false)
      alert('✅ Premio guardado correctamente')
    } catch (err) {
      console.error("Error savePremio:", err)
      alert('❌ Error al guardar premio: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleGrant = async () => {
    if (saving) return
    setSaving(true)
    try {
      if (tabGift === 'masivo') {
        if (!giftPremioId) { alert("Selecciona un premio"); setSaving(false); return }
        const { data, error } = await supabase.rpc('regalar_premio_masivo', { p_premio_id: giftPremioId, p_admin_id: adminPerfil?.id })
        if (error) {
          if (error.message.includes('not found') || error.message.includes('404')) {
             alert('⚠️ ERROR DE INSTALACIÓN: Debes ejecutar el archivo "039_ruleta_masivo.sql" en tu Editor SQL de Supabase.')
          } else alert(error.message)
          setSaving(false); return
        }
        alert(`✅ ¡Enviado masivamente a ${data.usuarios_afectados} usuarios!`)
      } else {
        if (!giftTarget) { alert("Selecciona un usuario"); setSaving(false); return }
        
        if (giftMode === 'giros') {
          // Asignar giros
          const { data: current } = await supabase.from('ruleta_giros_disponibles').select('giros_disponibles,total_ganados').eq('cliente_id', giftTarget).maybeSingle()
          const newDisp = (current?.giros_disponibles || 0) + Number(giftAmount)
          const newTotal = (current?.total_ganados || 0) + Number(giftAmount)
          
          const { error: updErr } = await supabase.from('ruleta_giros_disponibles').upsert({
            cliente_id: giftTarget,
            giros_disponibles: newDisp,
            total_ganados: newTotal,
            updated_at: new Date().toISOString()
          })
          if (updErr) throw updErr
          alert(`✅ ${giftAmount} giros asignados correctamente.`)
        } else {
          // Regalar PREMIO DIRECTO
          if (!giftPremioId) { alert("Selecciona el premio"); setSaving(false); return }
          const { data: p, error: pErr } = await supabase.from('ruleta_premios').select('*').eq('id', giftPremioId).single()
          if (pErr || !p) throw new Error("No se encontró el premio")

          // 1. Registrar el giro en el historial
          const { data: g, error: gErr } = await supabase.from('ruleta_giros').insert({
            cliente_id: giftTarget, premio_id: p.id, premio_nombre: p.nombre, tipo: p.tipo, valor: p.valor, acreditado: true
          }).select().single()
          if (gErr) throw gErr
          
          // 2. Acreditar el premio según el tipo
          if (p.tipo === 'saldo_usd' || p.tipo === 'saldo_bs') {
            const field = p.tipo === 'saldo_usd' ? 'saldo' : 'saldo_bs'
            
            // Usar 'billeteras' (según la migración 023/028) en lugar de 'perfiles'
            const { data: wallet, error: fetchErr } = await supabase.from('billeteras').select(field).eq('auth_user_id', giftTarget).maybeSingle()
            if (fetchErr) throw fetchErr
            
            const newBalance = (Number(wallet?.[field]) || 0) + Number(p.valor)
            const { error: balErr } = await supabase.from('billeteras').upsert({ 
              auth_user_id: giftTarget, 
              [field]: newBalance,
              updated_at: new Date().toISOString()
            }, { onConflict: 'auth_user_id' })
            if (balErr) throw balErr

            // Registrar transacción en historial de billetera para transparencia
            await supabase.from('billetera_transacciones').insert({
              auth_user_id: giftTarget,
              monto: p.valor,
              tipo: 'ajuste_admin',
              descripcion: `Premio Ruleta: ${p.nombre}`,
              moneda: p.tipo === 'saldo_usd' ? 'usd' : 'bs',
              referencia_id: g.id
            })
          } else if (p.tipo === 'descuento') {
            const { error: descErr } = await supabase.from('ruleta_descuentos_pendientes').insert({
              cliente_id: giftTarget, giro_id: g.id, porcentaje: p.valor, nombre: p.nombre
            })
            if (descErr) throw descErr
          }
          alert(`✅ Premio "${p.nombre}" asignado directamente.`)
        }
      }
      setShowGift(false); fetchUsuarios(); setGiftTarget(''); setGiftSearch('')
    } catch(e) { 
      console.error(e)
      alert('❌ Error al procesar regalo: ' + e.message) 
    }
    setSaving(false)
  }

  // ── Component Styles ──────────────────────────────────────────────
  const tabBtn = (id) => ({
    padding: '12px 24px', borderRadius: 16, border: 'none', fontWeight: 900, cursor: 'pointer', transition: 'all .2s',
    background: tab === id ? 'linear-gradient(135deg,#a855f7,#7c3aed)' : 'rgba(255,255,255,.03)',
    color: tab === id ? '#fff' : 'rgba(255,255,255,.4)',
    boxShadow: tab === id ? '0 10px 20px rgba(168,85,247,.3)' : 'none',
  })

  return (
    <div style={{ color:'var(--text-primary)', paddingBottom:60 }}>
      {/* Header Area */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:40 }}>
        <div>
          <div style={{ background:'rgba(255,215,0,.1)', color:'#FFD700', padding:'6px 14px', borderRadius:20, width:'fit-content', fontSize:12, fontWeight:800, marginBottom:10, border:'1px solid rgba(255,215,0,.2)' }}>MODO ADMINISTRADOR</div>
          <h1 style={{ fontSize:38, fontWeight:1000, color:'#fff', margin:0, letterSpacing:'-1px' }}>Gestión de Ruleta</h1>
          <p style={{ color:'rgba(255,255,255,.4)', fontSize:15, margin:0 }}>Control total sobre premios, giros y configuraciones premium.</p>
        </div>
      </div>

      {/* Tabs Selector */}
      <div style={{ display:'flex', gap:10, marginBottom:35, background:'rgba(255,255,255,.02)', padding:8, borderRadius:22, width:'fit-content', border:'1px solid rgba(255,255,255,.05)' }}>
        <button onClick={() => setTab('premios')} style={tabBtn('premios')}>🎡 Premios</button>
        <button onClick={() => setTab('usuarios')} style={tabBtn('usuarios')}>👥 Usuarios</button>
        <button onClick={() => setTab('historial')} style={tabBtn('historial')}>📜 Historial</button>
        <button onClick={() => setTab('config')} style={tabBtn('config')}>⚙️ Config</button>
      </div>

      {/* --- PREMIOS TAB --- */}
      {tab === 'premios' && (
        <div className="tab-pane animate-in">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
            <h2 style={{ fontSize:22, fontWeight:900, margin:0 }}>Inventario de Premios</h2>
            <div style={{ display:'flex', gap:12 }}>
              <button onClick={() => setShowGift(true)} className="btn" style={{ background:'rgba(168,85,247,.1)', color:'#c084fc', border:'1px solid rgba(168,85,247,.2)', padding:'10px 20px', borderRadius:12 }}>🎁 Regalar</button>
              <button onClick={() => { setForm(EMPTY_FORM); setEditing(null); setShowForm(true) }} className="btn btn-primary" style={{ padding:'10px 24px', borderRadius:12, boxShadow:'0 8px 15px rgba(255,255,255,.05)' }}>+ Agregar</button>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:20 }}>
            {premios.map(p => (
              <div key={p.id} className="card" style={{ background:p.activo?'rgba(255,255,255,.03)':'rgba(255,255,255,.01)', borderLeft:`6px solid ${p.color}`, padding:24, borderRadius:20, position:'relative', border:'1px solid rgba(255,255,255,.05)', transition:'transform .2s', opacity:p.activo?1:0.6 }}>
                <div style={{ fontSize:40, marginBottom:15 }}>{p.emoji}</div>
                <h4 style={{ fontSize:19, fontWeight:900, marginBottom:5 }}>{p.nombre}</h4>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:15 }}>
                  <span style={{ fontSize:11, padding:'4px 10px', background:'rgba(255,255,255,.05)', borderRadius:8, fontWeight:700 }}>{TIPOS.find(t=>t.value===p.tipo)?.label}</span>
                  <span style={{ fontSize:11, padding:'4px 10px', background:'rgba(168,85,247,.1)', color:'#c084fc', borderRadius:8, fontWeight:700 }}>Prob: {p.probabilidad}%</span>
                  {p.valor > 0 && <span style={{ fontSize:11, padding:'4px 10px', background:'rgba(34,197,94,.1)', color:'#4ade80', borderRadius:8, fontWeight:700 }}>Val: {p.valor}</span>}
                </div>
                <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                  <button onClick={() => { setForm(p); setEditing(p.id); setShowForm(true) }} className="btn btn-sm" style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)' }}>✏️</button>
                  <button onClick={async () => { if(confirm('¿Seguro?')) { await supabase.from('ruleta_premios').delete().eq('id', p.id); fetchPremios() } }} className="btn btn-sm" style={{ background:'rgba(239,68,68,.1)', color:'#f87171', border:'1px solid rgba(239,68,68,.1)' }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- USUARIOS TAB --- */}
      {tab === 'usuarios' && (
        <div className="card animate-in" style={{ padding:0, borderRadius:24, overflow:'hidden', background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.05)' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead style={{ background:'rgba(255,255,255,.03)' }}>
                <tr>
                  <th style={{ padding:'20px 24px', textAlign:'left', fontSize:12, textTransform:'uppercase', letterSpacing:1, color:'rgba(255,255,255,.4)' }}>Usuario</th>
                  <th style={{ padding:'20px 24px', textAlign:'center', fontSize:12, textTransform:'uppercase', letterSpacing:1, color:'rgba(255,255,255,.4)' }}>Giros</th>
                  <th style={{ padding:'20px 24px', textAlign:'right', fontSize:12, textTransform:'uppercase', letterSpacing:1, color:'rgba(255,255,255,.4)' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.cliente_id} style={{ borderBottom:'1px solid rgba(255,255,255,.02)', transition:'background .15s' }}>
                    <td style={{ padding:'18px 24px' }}>
                      <div style={{ fontWeight:800, fontSize:15 }}>{u.email}</div>
                      <div style={{ fontSize:11, color:'rgba(255,255,255,.3)' }}>ID: {u.cliente_id.slice(0,8)}</div>
                    </td>
                    <td style={{ padding:'18px 24px', textAlign:'center' }}>
                      <div style={{ display:'inline-block', padding:'6px 14px', background:'rgba(168,85,247,.1)', color:'#c084fc', borderRadius:20, fontWeight:900, minWidth:40 }}>{u.giros_disponibles}</div>
                    </td>
                    <td style={{ padding:'18px 24px', textAlign:'right' }}>
                      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                        <input type="number" value={giroInput[u.cliente_id] || ''} onChange={e=>setGiroInput(p=>({...p, [u.cliente_id]: e.target.value}))} style={{ width:70, padding:8, background:'rgba(0,0,0,.3)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, color:'#fff', textAlign:'center' }} placeholder="0" />
                        <button onClick={async () => { const v = parseInt(giroInput[u.cliente_id]); if(v>0){ await asignarGirosToUser(u.cliente_id, v); setGiroInput(p=>({...p, [u.cliente_id]:''})); fetchUsuarios() } }} className="btn btn-primary btn-sm" style={{ borderRadius:10 }}>+ Add</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- CONFIG TAB --- */}
      {tab === 'config' && (
        <div className="card animate-in" style={{ padding:40, maxWidth:580, borderRadius:28 }}>
          <h2 style={{ fontSize:26, fontWeight:1000, marginBottom:30 }}>⚙️ Configuración Global</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
            <div className="form-group">
              <label className="form-label" style={{ marginBottom:12, display:'block' }}>Estado de la Ruleta</label>
              <div style={{ display:'flex', gap:10 }}>
                {[['true','✅ ACTIVADA'],['false','⏸ DESACTIVADA']].map(([v,l])=>(
                  <button key={v} onClick={()=>setConfig(p=>({...p,ruleta_activa:v}))} style={{ flex:1, padding:'15px', borderRadius:16, border:`2px solid ${config.ruleta_activa===v?'#a855f7':'rgba(255,255,255,.05)'}`, background:config.ruleta_activa===v?'rgba(168,85,247,.1)':'rgba(255,255,255,.02)', color:config.ruleta_activa===v?'#c084fc':'rgba(255,255,255,.3)', fontWeight:900, cursor:'pointer' }}>{l}</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Título del Banner</label>
              <input className="form-input" value={config.ruleta_titulo} onChange={e=>setConfig(p=>({...p,ruleta_titulo:e.target.value}))} style={{ padding:14, borderRadius:12 }} />
            </div>
            <div className="form-group" style={{ marginBottom:15 }}>
              <label className="form-label">Descripción</label>
              <textarea className="form-input" rows={3} value={config.ruleta_descripcion} onChange={e=>setConfig(p=>({...p,ruleta_descripcion:e.target.value}))} style={{ padding:14, borderRadius:12, resize:'none' }} />
            </div>
            <button className="btn btn-primary" style={{ height:55, borderRadius:16, fontSize:16, fontWeight:900 }} disabled={saving} onClick={saveConfig}>{saving?'Guardando...':'💾 GUARDAR CAMBIOS'}</button>
          </div>
        </div>
      )}

      {/* --- MODAL REGALAR --- */}
      {showGift && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,.85)', backdropFilter:'blur(12px)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }} onClick={()=>setShowGift(false)}>
          <div className="card shadow-lg animate-scale" style={{ width:'100%', maxWidth:480, padding:32, borderRadius:32, border:'1px solid rgba(255,255,255,.1)', maxHeight:'90vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
            <h2 style={{ fontSize:28, fontWeight:1000, marginBottom:25, textAlign:'center' }}>🎁 Regalar a Usuarios</h2>
            
            <div style={{ display:'flex', gap:8, marginBottom:25, background:'rgba(255,255,255,.03)', padding:6, borderRadius:18 }}>
              <button onClick={()=>setTabGift('individual')} style={{ flex:1, padding:12, borderRadius:14, border:'none', background:tabGift==='individual'?'#a855f7':'none', color:tabGift==='individual'?'#fff':'rgba(255,255,255,.4)', fontWeight:800, cursor:'pointer' }}>INDIVIDUAL</button>
              <button onClick={()=>setTabGift('masivo')} style={{ flex:1, padding:12, borderRadius:14, border:'none', background:tabGift==='masivo'?'#a855f7':'none', color:tabGift==='masivo'?'#fff':'rgba(255,255,255,.4)', fontWeight:800, cursor:'pointer' }}>TODO EL SISTEMA</button>
            </div>

            {tabGift === 'individual' ? (
              <>
                <div style={{ marginBottom:20 }}>
                   <label className="form-label" style={{ fontSize:12, opacity:0.6 }}>🔍 Selecciona Cliente</label>
                   <input className="form-input" placeholder="Buscar por email o nombre..." value={giftSearch} onChange={e=>setGiftSearch(e.target.value)} style={{ marginBottom:12, borderRadius:14 }} />
                   <div style={{ maxHeight:180, overflowY:'auto', display:'flex', flexDirection:'column', gap:5, background:'rgba(0,0,0,.2)', padding:10, borderRadius:14, border:'1px solid rgba(255,255,255,.05)' }}>
                     {allClients.filter(c => (c.email+c.nombre).toLowerCase().includes(giftSearch.toLowerCase())).slice(0,30).map(c => (
                       <button key={c.id} onClick={()=>setGiftTarget(c.id)} style={{ padding:12, borderRadius:10, border:'none', textAlign:'left', background:giftTarget===c.id?'rgba(168,85,247,.2)':'none', color:giftTarget===c.id?'#c084fc':'#fff', cursor:'pointer', fontWeight:giftTarget===c.id?800:400 }}>{c.nombre || c.email} {c.nombre && <small style={{ opacity:0.4 }}>({c.email})</small>}</button>
                     ))}
                   </div>
                </div>
                <div style={{ display:'flex', gap:10, marginBottom:20 }}>
                  <button onClick={()=>setGiftMode('giros')} style={{ flex:1, padding:'10px', borderRadius:12, border:giftMode==='giros'?'1px solid #c084fc':'1px solid rgba(255,255,255,.1)', background:giftMode==='giros'?'rgba(168,85,247,.1)':'none', color:giftMode==='giros'?'#c084fc':'#fff', fontSize:11, fontWeight:800 }}>MANDAR GIROS</button>
                  <button onClick={()=>setGiftMode('premio')} style={{ flex:1, padding:'10px', borderRadius:12, border:giftMode==='premio'?'1px solid #c084fc':'1px solid rgba(255,255,255,.1)', background:giftMode==='premio'?'rgba(168,85,247,.1)':'none', color:giftMode==='premio'?'#c084fc':'#fff', fontSize:11, fontWeight:800 }}>PREMIO DIRECTO</button>
                </div>
                {giftMode === 'giros' ? (
                  <div className="form-group">
                    <label className="form-label">Cantidad de giros</label>
                    <div style={{ display:'flex', alignItems:'center', gap:15, background:'rgba(255,255,255,.05)', padding:8, borderRadius:16, justifyContent:'center' }}>
                      <button onClick={()=>setGiftAmount(g=>Math.max(1,g-1))} style={{ width:40, height:40, borderRadius:12, border:'none', background:'rgba(255,255,255,.1)', color:'#fff', cursor:'pointer' }}>-</button>
                      <span style={{ fontSize:32, fontWeight:1000, color:'#a855f7' }}>{giftAmount}</span>
                      <button onClick={()=>setGiftAmount(g=>g+1)} style={{ width:40, height:40, borderRadius:12, border:'none', background:'rgba(255,255,255,.1)', color:'#fff', cursor:'pointer' }}>+</button>
                    </div>
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">Elige el Premio</label>
                    <select className="form-input" value={giftPremioId} onChange={e=>setGiftPremioId(e.target.value)} style={{ borderRadius:14 }}>
                      <option value="">Seleccionar premio...</option>
                      {premios.filter(p=>p.activo).map(p=>(<option key={p.id} value={p.id}>{p.emoji} {p.nombre}</option>))}
                    </select>
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding:'20px', background:'rgba(168,85,247,.05)', borderRadius:20, border:'1px dashed rgba(168,85,247,.3)', marginBottom:20 }}>
                 <p style={{ margin:0, fontSize:13, color:'#c084fc', textAlign:'center', marginBottom:15 }}>¡Regala un premio a toda la comunidad!</p>
                 <select className="form-input" value={giftPremioId} onChange={e=>setGiftPremioId(e.target.value)} style={{ borderRadius:14, background:'rgba(0,0,0,.3)' }}>
                    <option value="">Seleccionar premio masivo...</option>
                    {premios.filter(p=>p.activo).map(p=>(<option key={p.id} value={p.id}>{p.emoji} {p.nombre}</option>))}
                 </select>
              </div>
            )}

            <button onClick={handleGrant} disabled={saving || (!giftTarget && tabGift==='individual') || (!giftPremioId && (tabGift==='masivo' || giftMode==='premio'))} className="btn btn-primary" style={{ width:'100%', height:60, borderRadius:18, marginTop:10, fontSize:16, fontWeight:1000, background:'linear-gradient(135deg,#a855f7,#7c3aed)', boxShadow:'0 10px 25px rgba(168,85,247,.4)' }}>
              {saving ? 'PROCESANDO...' : (tabGift==='masivo'?'📢 REGALAR A TODOS':'🎁 REGALAR PREMIO')}
            </button>
          </div>
        </div>
      )}

      {/* --- FORM EDIT/NEWPREMIO --- */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,.9)', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={()=>setShowForm(false)}>
           <div className="card shadow-2xl scale-in" style={{ width:'100%', maxWidth:440, padding:35, borderRadius:32, border:'1px solid rgba(255,255,255,.1)' }} onClick={e=>e.stopPropagation()}>
              <h2 style={{ fontSize:26, fontWeight:1000, marginBottom:25 }}>{editing?'Editar':'Nuevo'} Premio</h2>
              <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
                <div style={{ display:'flex', gap:12 }}>
                  <input className="form-input" placeholder="Emoji" value={form.emoji} onChange={e=>setForm({...form, emoji:e.target.value})} style={{ width:70, textAlign:'center', fontSize:24 }} />
                  <input className="form-input" placeholder="Nombre del premio" value={form.nombre} onChange={e=>setForm({...form, nombre:e.target.value})} style={{ flex:1 }} />
                </div>
                <select className="form-input" value={form.tipo} onChange={e=>setForm({...form, tipo:e.target.value})}>
                  {TIPOS.map(t=>(<option key={t.value} value={t.value}>{t.label}</option>))}
                </select>
                <div style={{ display:'flex', gap:12 }}>
                  <div style={{ flex:1 }}>
                    <label style={{ fontSize:10, opacity:0.5, marginLeft:5 }}>VALOR</label>
                    <input className="form-input" type="number" placeholder="Monto / %" value={form.valor} onChange={e=>setForm({...form, valor:e.target.value})} />
                  </div>
                  <div style={{ flex:1 }}>
                    <label style={{ fontSize:10, opacity:0.5, marginLeft:5 }}>PROBABILIDAD %</label>
                    <input className="form-input" type="number" placeholder="1-100" value={form.probabilidad} onChange={e=>setForm({...form, probabilidad:e.target.value})} />
                  </div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                   {COLORS_PRESET.map(c => (
                     <button key={c} onClick={()=>setForm({...form, color:c})} style={{ width:24, height:24, borderRadius:6, background:c, border:form.color===c?'2px solid #fff':'none', cursor:'pointer' }} />
                   ))}
                </div>
                <button className="btn btn-primary" style={{ height:55, borderRadius:16, fontWeight:900, marginTop:10 }} onClick={savePremio}>{saving?'Guardando...':'💾 GUARDAR PREMIO'}</button>
              </div>
           </div>
        </div>
      )}
    </div>
  )
}
