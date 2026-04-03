import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatUSD, formatBs } from '../utils/helpers'

const COLORS_PRESET = ['#FF6B6B','#FF8E53','#FFCA28','#66BB6A','#26C6DA','#5C6BC0','#AB47BC','#EC407A','#FF7043','#26A69A']
const TIPOS = [
  { value: 'saldo_usd', label: '💵 Saldo USD (Billetera)', hasValue: true },
  { value: 'saldo_bs',  label: '💜 Saldo Bs (Billetera)',  hasValue: true },
  { value: 'mensaje',   label: '🎁 Premio Especial / Mensaje', hasValue: false },
  { value: 'sin_premio',label: '😢 Sin Premio',            hasValue: false },
]
const EMOJIS = ['🎁','💰','⭐','🏆','💎','🎉','🎊','🌟','🔥','💥','🍀','🎯','🥇','🎀']

const EMPTY_FORM = { nombre: '', descripcion: '', tipo: 'mensaje', valor: '', probabilidad: 10, color: '#FF6B6B', emoji: '🎁', activo: true }

export default function GestionRuleta() {
  const [tab, setTab]               = useState('premios')
  const [premios, setPremios]       = useState([])
  const [historial, setHistorial]   = useState([])
  const [usuarios, setUsuarios]     = useState([])
  const [config, setConfig]         = useState({ ruleta_activa: 'true', ruleta_titulo: '¡Gira y Gana!', ruleta_descripcion: '' })
  const [form, setForm]             = useState(EMPTY_FORM)
  const [editing, setEditing]       = useState(null)
  const [showForm, setShowForm]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [loadingTab, setLoadingTab] = useState(false)
  const [giroInput, setGiroInput]   = useState({}) // { clienteId: cantidad }

  useEffect(() => { fetchPremios(); fetchConfig() }, [])
  useEffect(() => {
    if (tab === 'historial') fetchHistorial()
    if (tab === 'usuarios')  fetchUsuarios()
  }, [tab])

  // ── Fetch ────────────────────────────────────────────────────
  const fetchPremios = async () => {
    const { data } = await supabase.from('ruleta_premios').select('*').order('created_at')
    setPremios(data || [])
  }
  const fetchConfig = async () => {
    const { data } = await supabase.from('configuracion').select('ruleta_activa,ruleta_titulo,ruleta_descripcion').single()
    if (data) setConfig(prev => ({ ...prev, ...data }))
  }
  const fetchHistorial = async () => {
    setLoadingTab(true)
    const { data } = await supabase
      .from('ruleta_giros')
      .select('*, perfiles:cliente_id(email:id)')
      .order('created_at', { ascending: false })
      .limit(100)
    // Fetch emails separately
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
    // Enrich with email
    const ids = (data || []).map(d => d.cliente_id)
    let emailMap = {}
    if (ids.length > 0) {
      const { data: perfs } = await supabase.from('perfiles').select('id,email').in('id', ids)
      ;(perfs || []).forEach(p => { emailMap[p.id] = p.email })
    }
    setUsuarios((data || []).map(d => ({ ...d, email: emailMap[d.cliente_id] || d.cliente_id.slice(0,8) + '…' })))
    setLoadingTab(false)
  }

  // ── Premios CRUD ─────────────────────────────────────────────
  const openAdd = () => { setForm(EMPTY_FORM); setEditing(null); setShowForm(true) }
  const openEdit = (p) => { setForm({ nombre: p.nombre, descripcion: p.descripcion || '', tipo: p.tipo, valor: p.valor || '', probabilidad: p.probabilidad, color: p.color, emoji: p.emoji || '🎁', activo: p.activo }); setEditing(p.id); setShowForm(true) }

  const savePremio = async () => {
    setSaving(true)
    const payload = { ...form, valor: Number(form.valor) || 0, probabilidad: Number(form.probabilidad) || 1 }
    if (editing) {
      await supabase.from('ruleta_premios').update(payload).eq('id', editing)
    } else {
      await supabase.from('ruleta_premios').insert(payload)
    }
    await fetchPremios()
    setShowForm(false)
    setSaving(false)
  }

  const toggleActivo = async (p) => {
    await supabase.from('ruleta_premios').update({ activo: !p.activo }).eq('id', p.id)
    fetchPremios()
  }
  const deletePremio = async (id) => {
    if (!confirm('¿Eliminar este premio?')) return
    await supabase.from('ruleta_premios').delete().eq('id', id)
    fetchPremios()
  }

  // ── Config save ───────────────────────────────────────────────
  const saveConfig = async () => {
    setSaving(true)
    await supabase.from('configuracion').update({ ruleta_activa: config.ruleta_activa, ruleta_titulo: config.ruleta_titulo, ruleta_descripcion: config.ruleta_descripcion })
    setSaving(false)
    alert('Configuración guardada ✔')
  }

  // ── Asignar giros manuales ────────────────────────────────────
  const asignarGiros = async (clienteId) => {
    const cantidad = Number(giroInput[clienteId] || 1)
    if (cantidad < 1) return
    await supabase.from('ruleta_giros_disponibles').upsert({ cliente_id: clienteId, giros_disponibles: cantidad, total_ganados: 0 }, { onConflict: 'cliente_id' })
    // Use RPC-less approach: just increment
    const { data: existing } = await supabase.from('ruleta_giros_disponibles').select('giros_disponibles,total_ganados').eq('cliente_id', clienteId).single()
    if (existing) {
      await supabase.from('ruleta_giros_disponibles').update({ giros_disponibles: existing.giros_disponibles + cantidad, total_ganados: existing.total_ganados + cantidad, updated_at: new Date().toISOString() }).eq('cliente_id', clienteId)
    }
    setGiroInput(prev => ({ ...prev, [clienteId]: '' }))
    fetchUsuarios()
  }

  // ── Styles ────────────────────────────────────────────────────
  const tabStyle = (t) => ({
    padding: '10px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer', borderRadius: 10,
    background: tab === t ? 'var(--accent-primary)' : 'rgba(255,255,255,.04)',
    color: tab === t ? '#000' : 'var(--text-muted)',
    border: tab === t ? 'none' : '1px solid rgba(255,255,255,.08)',
    transition: 'all .2s'
  })

  const totalProb = premios.filter(p => p.activo).reduce((s, p) => s + p.probabilidad, 0)

  return (
    <div className="page-content">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 4 }}>🎡 Gestión de Ruleta</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Configura los premios, asigna giros y revisa el historial</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {[['premios','🎁 Premios'],['usuarios','👥 Usuarios & Giros'],['historial','📜 Historial'],['config','⚙️ Configuración']].map(([k,l]) => (
          <button key={k} style={tabStyle(k)} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {/* ── TAB: PREMIOS ── */}
      {tab === 'premios' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {premios.filter(p=>p.activo).length} premios activos · Total peso: <strong style={{ color: 'var(--text-primary)' }}>{totalProb}</strong>
            </div>
            <button className="btn btn-primary" onClick={openAdd}>+ Agregar Premio</button>
          </div>

          {premios.length === 0 ? (
            <div className="card" style={{ textAlign:'center', padding:'60px 40px' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🎁</div>
              <h3>Aún no hay premios</h3>
              <p style={{ color:'var(--text-muted)' }}>Agrega el primer premio para configurar la ruleta</p>
              <button className="btn btn-primary" style={{ marginTop:12 }} onClick={openAdd}>+ Agregar Premio</button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {premios.map(p => {
                const pct = totalProb > 0 ? ((p.probabilidad / totalProb) * 100).toFixed(1) : 0
                const tipo = TIPOS.find(t => t.value === p.tipo)
                return (
                  <div key={p.id} className="card" style={{ padding:'16px 20px', display:'flex', alignItems:'center', gap:16, opacity: p.activo ? 1 : 0.5 }}>
                    {/* Color swatch */}
                    <div style={{ width:44, height:44, borderRadius:12, background: p.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{p.emoji}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:800, fontSize:15 }}>{p.nombre}</div>
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
                        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'rgba(255,255,255,.06)', color:'var(--text-muted)' }}>{tipo?.label || p.tipo}</span>
                        {p.valor > 0 && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'rgba(34,197,94,.1)', color:'#22c55e' }}>{p.tipo === 'saldo_usd' ? formatUSD(p.valor) : formatBs(p.valor)}</span>}
                        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'rgba(99,102,241,.1)', color:'#818cf8' }}>Peso: {p.probabilidad} ({pct}%)</span>
                      </div>
                      {p.descripcion && <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4, textOverflow:'ellipsis', overflow:'hidden', whiteSpace:'nowrap' }}>{p.descripcion}</div>}
                    </div>
                    <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                      <button className="btn" style={{ padding:'6px 12px', fontSize:12 }} onClick={() => toggleActivo(p)}>{p.activo ? '⏸ Pausar' : '▶ Activar'}</button>
                      <button className="btn" style={{ padding:'6px 12px', fontSize:12 }} onClick={() => openEdit(p)}>✏️</button>
                      <button className="btn" style={{ padding:'6px 12px', fontSize:12, color:'#ef4444', borderColor:'rgba(239,68,68,.3)' }} onClick={() => deletePremio(p.id)}>🗑</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Form modal */}
          {showForm && (
            <div style={{ position:'fixed', inset:0, zIndex:40000, background:'rgba(0,0,0,.85)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
              <div className="card" style={{ width:'100%', maxWidth:500, padding:28, maxHeight:'90vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
                <h3 style={{ fontWeight:900, marginBottom:20 }}>{editing ? 'Editar Premio' : '+ Nuevo Premio'}</h3>

                <div className="form-group" style={{ marginBottom:14 }}>
                  <label className="form-label">Nombre del premio *</label>
                  <input className="form-input" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))} placeholder="Ej: $1 de saldo, Recarga especial…" />
                </div>

                <div className="form-group" style={{ marginBottom:14 }}>
                  <label className="form-label">Tipo *</label>
                  <select className="form-input" value={form.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value,valor:''}))}>
                    {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                {TIPOS.find(t=>t.value===form.tipo)?.hasValue && (
                  <div className="form-group" style={{ marginBottom:14 }}>
                    <label className="form-label">Valor ({form.tipo === 'saldo_usd' ? 'USD' : 'Bs'}) *</label>
                    <input className="form-input" type="number" min="0" step="0.01" value={form.valor} onChange={e=>setForm(p=>({...p,valor:e.target.value}))} placeholder="0.00" />
                  </div>
                )}

                <div className="form-group" style={{ marginBottom:14 }}>
                  <label className="form-label">Descripción (opcional)</label>
                  <input className="form-input" value={form.descripcion} onChange={e=>setForm(p=>({...p,descripcion:e.target.value}))} placeholder="Texto adicional que verá el usuario al ganar…" />
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
                  <div className="form-group">
                    <label className="form-label">Peso / Probabilidad (1-100)</label>
                    <input className="form-input" type="number" min="1" max="100" value={form.probabilidad} onChange={e=>setForm(p=>({...p,probabilidad:e.target.value}))} />
                    <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>Mayor peso = más probable</p>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Emoji</label>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
                      {EMOJIS.map(e => (
                        <button key={e} onClick={()=>setForm(p=>({...p,emoji:e}))} style={{ fontSize:20, background:form.emoji===e?'rgba(99,102,241,.3)':'rgba(255,255,255,.05)', border:`2px solid ${form.emoji===e?'var(--accent-primary)':'transparent'}`, borderRadius:8, width:36, height:36, cursor:'pointer' }}>{e}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom:20 }}>
                  <label className="form-label">Color del segmento</label>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:6 }}>
                    {COLORS_PRESET.map(c => (
                      <div key={c} onClick={()=>setForm(p=>({...p,color:c}))} style={{ width:32, height:32, borderRadius:8, background:c, cursor:'pointer', border:`3px solid ${form.color===c?'white':'transparent'}`, transition:'border .15s' }} />
                    ))}
                    <input type="color" value={form.color} onChange={e=>setForm(p=>({...p,color:e.target.value}))} style={{ width:32, height:32, padding:0, border:'none', borderRadius:8, cursor:'pointer' }} />
                  </div>
                </div>

                <div style={{ display:'flex', gap:10 }}>
                  <button className="btn btn-primary" style={{ flex:1 }} disabled={saving || !form.nombre} onClick={savePremio}>{saving ? 'Guardando…' : editing ? 'Guardar Cambios' : 'Crear Premio'}</button>
                  <button className="btn" style={{ flex:1 }} onClick={()=>setShowForm(false)}>Cancelar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: USUARIOS & GIROS ── */}
      {tab === 'usuarios' && (
        <div>
          <p style={{ color:'var(--text-muted)', fontSize:13, marginBottom:16 }}>Gestiona los giros disponibles por usuario. Cada pedido completado asigna 1 giro automáticamente.</p>
          {loadingTab ? <div className="spinner" /> : usuarios.length === 0 ? (
            <div className="card" style={{ textAlign:'center', padding:'60px 40px' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>👥</div>
              <p style={{ color:'var(--text-muted)' }}>Ningún usuario tiene giros registrados aún</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {usuarios.map(u => (
                <div key={u.cliente_id} className="card" style={{ padding:'14px 20px', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:180 }}>
                    <div style={{ fontWeight:700, fontSize:14 }}>{u.email}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
                      Total ganados: {u.total_ganados} · Último: {new Date(u.updated_at).toLocaleDateString('es-VE')}
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:12, background: u.giros_disponibles > 0 ? 'rgba(255,215,0,.1)' : 'rgba(255,255,255,.04)', border:`1px solid ${u.giros_disponibles > 0 ? 'rgba(255,215,0,.3)' : 'rgba(255,255,255,.08)'}` }}>
                    <span style={{ fontWeight:900, fontSize:18, color: u.giros_disponibles > 0 ? '#FFD700' : 'var(--text-muted)' }}>{u.giros_disponibles}</span>
                    <span style={{ fontSize:12, color:'var(--text-muted)' }}>giros</span>
                  </div>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input type="number" min="1" max="99" value={giroInput[u.cliente_id] || ''} onChange={e=>setGiroInput(prev=>({...prev,[u.cliente_id]:e.target.value}))} placeholder="N°" style={{ width:60, padding:'6px 8px', borderRadius:8, border:'1px solid rgba(255,255,255,.15)', background:'var(--bg-input,#1e2035)', color:'var(--text-primary)', fontSize:14, textAlign:'center' }} />
                    <button className="btn btn-primary" style={{ padding:'6px 14px', fontSize:12 }} onClick={()=>asignarGiros(u.cliente_id)}>+ Asignar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: HISTORIAL ── */}
      {tab === 'historial' && (
        <div>
          {loadingTab ? <div className="spinner" /> : historial.length === 0 ? (
            <div className="card" style={{ textAlign:'center', padding:'60px 40px' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>📜</div>
              <p style={{ color:'var(--text-muted)' }}>No hay giros registrados aún</p>
            </div>
          ) : (
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid rgba(255,255,255,.08)' }}>
                      {['Usuario','Premio','Tipo','Valor','Acreditado','Fecha'].map(h=>(
                        <th key={h} style={{ padding:'12px 16px', textAlign:'left', color:'var(--text-muted)', fontWeight:700, whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((g,i) => (
                      <tr key={g.id} style={{ borderBottom:'1px solid rgba(255,255,255,.04)', background: i%2===0?'transparent':'rgba(255,255,255,.015)' }}>
                        <td style={{ padding:'10px 16px', color:'var(--text-muted)', fontFamily:'monospace', fontSize:11 }}>{g.cliente_id?.slice(0,12)}…</td>
                        <td style={{ padding:'10px 16px', fontWeight:700 }}>{g.premio_nombre}</td>
                        <td style={{ padding:'10px 16px' }}><span style={{ padding:'2px 8px', borderRadius:20, background:'rgba(255,255,255,.06)', fontSize:11 }}>{g.tipo}</span></td>
                        <td style={{ padding:'10px 16px', fontWeight:700, color: g.tipo==='saldo_usd'?'#22c55e':g.tipo==='saldo_bs'?'#a855f7':'var(--text-muted)' }}>
                          {g.valor > 0 ? (g.tipo==='saldo_usd'?formatUSD(g.valor):formatBs(g.valor)) : '—'}
                        </td>
                        <td style={{ padding:'10px 16px' }}>{g.acreditado ? <span style={{ color:'#22c55e' }}>✅</span> : <span style={{ color:'var(--text-muted)' }}>—</span>}</td>
                        <td style={{ padding:'10px 16px', color:'var(--text-muted)', whiteSpace:'nowrap', fontSize:11 }}>{new Date(g.created_at).toLocaleString('es-VE')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: CONFIG ── */}
      {tab === 'config' && (
        <div className="card" style={{ padding:28, maxWidth:500 }}>
          <h3 style={{ fontWeight:900, marginBottom:20 }}>⚙️ Configuración de la Ruleta</h3>

          <div className="form-group" style={{ marginBottom:16 }}>
            <label className="form-label">Estado</label>
            <div style={{ display:'flex', gap:10 }}>
              {[['true','✅ Activa'],['false','⏸ Desactivada']].map(([v,l])=>(
                <button key={v} onClick={()=>setConfig(p=>({...p,ruleta_activa:v}))} style={{ flex:1, padding:'10px', borderRadius:10, border:`2px solid ${config.ruleta_activa===v?'var(--accent-primary)':'rgba(255,255,255,.1)'}`, background:config.ruleta_activa===v?'rgba(0,210,255,.1)':'rgba(255,255,255,.03)', color:config.ruleta_activa===v?'var(--accent-primary)':'var(--text-muted)', fontWeight:700, cursor:'pointer' }}>{l}</button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom:16 }}>
            <label className="form-label">Título de la ruleta</label>
            <input className="form-input" value={config.ruleta_titulo} onChange={e=>setConfig(p=>({...p,ruleta_titulo:e.target.value}))} />
          </div>

          <div className="form-group" style={{ marginBottom:24 }}>
            <label className="form-label">Descripción</label>
            <textarea className="form-input" rows={2} value={config.ruleta_descripcion} onChange={e=>setConfig(p=>({...p,ruleta_descripcion:e.target.value}))} style={{ resize:'vertical' }} />
          </div>

          <button className="btn btn-primary" style={{ width:'100%', height:48 }} disabled={saving} onClick={saveConfig}>{saving?'Guardando…':'💾 Guardar Configuración'}</button>
        </div>
      )}
    </div>
  )
}
