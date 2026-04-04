import React, { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useData'
import { supabase } from '../lib/supabase'
import { formatUSD, formatBs } from '../utils/helpers'

// ── SVG Wheel helpers ──────────────────────────────────────────
const polar = (cx, cy, r, deg) => {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}
const arc = (cx, cy, r, a1, a2) => {
  const s = polar(cx, cy, r, a1)
  const e = polar(cx, cy, r, a2)
  const lg = a2 - a1 > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${lg} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)} Z`
}

const COLORS = [
  '#FF6B6B','#FF8E53','#FFCA28','#66BB6A',
  '#26C6DA','#5C6BC0','#AB47BC','#EC407A',
  '#FF7043','#26A69A','#FFA726','#8D6E63'
]

// ── Main Component ─────────────────────────────────────────────
export default function Ruleta() {
  const { user } = useAuth()
  const [premios, setPremios]             = useState([])
  const [config, setConfig]               = useState({ ruleta_activa: 'true', ruleta_titulo: '¡Gira y Gana!', ruleta_descripcion: '' })
  const [girosDisp, setGirosDisp]         = useState(0)
  const [spinning, setSpinning]           = useState(false)
  const [rotation, setRotation]           = useState(0)
  const [animate, setAnimate]             = useState(false)
  const [resultado, setResultado]         = useState(null)
  const [showModal, setShowModal]         = useState(false)
  const [historial, setHistorial]         = useState([])
  const [loading, setLoading]             = useState(true)

  const CX = 150, CY = 150, R = 128, R_TEXT = 90, R_INNER = 32

  useEffect(() => { if (user?.id) fetchAll() }, [user?.id])

  const fetchAll = async () => {
    setLoading(true)
    const [cfgRes, premiosRes, girosRes, histRes] = await Promise.all([
      supabase.from('configuracion').select('ruleta_activa,ruleta_titulo,ruleta_descripcion').single(),
      supabase.from('ruleta_premios').select('id,nombre,descripcion,tipo,valor,color,emoji,activo').eq('activo', true).order('created_at'),
      supabase.from('ruleta_giros_disponibles').select('giros_disponibles').eq('cliente_id', user.id).maybeSingle(),
      supabase.from('ruleta_giros').select('premio_nombre,tipo,valor,created_at').eq('cliente_id', user.id).order('created_at', { ascending: false }).limit(10)
    ])
    if (cfgRes.data) setConfig(prev => ({ ...prev, ...cfgRes.data }))
    setPremios(premiosRes.data || [])
    setGirosDisp(girosRes.data?.giros_disponibles || 0)
    setHistorial(histRes.data || [])
    setLoading(false)
  }

  // Build EQUAL-SIZE segments — probability is internal only (handled server-side by RPC)
  const segDeg = premios.length > 0 ? 360 / premios.length : 0
  const segments = []
  let accA = 0
  premios.forEach((p, i) => {
    segments.push({ ...p, startAngle: accA, endAngle: accA + segDeg, midAngle: accA + segDeg / 2, colorFallback: COLORS[i % COLORS.length] })
    accA += segDeg
  })

  const handleSpin = async () => {
    if (spinning || girosDisp <= 0 || segments.length === 0) return
    setSpinning(true)

    const { data: res, error } = await supabase.rpc('girar_ruleta', { p_cliente_id: user.id })
    if (error || res?.error) {
      setSpinning(false)
      alert(res?.error || error.message)
      return
    }

    // Find winner's center angle
    const winner = segments.find(s => s.id === res.premio_id)
    const targetAngle = winner ? winner.midAngle : 0

    // Spin: 6-8 full turns + land on segment
    const extraTurns = 6 + Math.floor(Math.random() * 3)
    const landAngle   = ((360 - (targetAngle % 360)) % 360)
    const newRotation = rotation + extraTurns * 360 + landAngle

    setAnimate(true)
    setRotation(newRotation)

    setTimeout(() => {
      setAnimate(false)
      setResultado(res)
      setGirosDisp(res.giros_restantes ?? Math.max(0, girosDisp - 1))
      setHistorial(prev => [{ premio_nombre: res.premio_nombre, tipo: res.tipo, valor: res.valor, created_at: new Date().toISOString() }, ...prev].slice(0, 10))
      setSpinning(false)
      setShowModal(true)
    }, 6000)
  }

  const isActive = config.ruleta_activa !== 'false'

  // ── Empty / Inactive states ────────────────────────────────
  if (loading) return <div className="page-content" style={{ textAlign: 'center', padding: 80 }}><div className="spinner" /></div>

  if (!isActive) return (
    <div className="page-content" style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center', padding: '80px 24px' }}>
      <div style={{ fontSize: 72, marginBottom: 16 }}>🎡</div>
      <h2>La ruleta no está disponible ahora</h2>
      <p style={{ color: 'var(--text-muted)' }}>Vuelve pronto para probar tu suerte 🍀</p>
    </div>
  )

  const wheelSize = Math.min(320, typeof window !== 'undefined' ? window.innerWidth - 64 : 320)

  return (
    <div className="page-content" style={{ maxWidth: 700, margin: '0 auto', padding: '0 16px 40px' }}>
      <style>{`
        @keyframes winPop  { 0%{transform:scale(0.5);opacity:0} 70%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
        @keyframes starSpin{ from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes spinBtn { 0%,100%{box-shadow:0 0 20px rgba(255,215,0,.5)} 50%{box-shadow:0 0 40px rgba(255,215,0,.9)} }
        @keyframes float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 20, paddingTop: 8 }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, margin: '0 0 6px', background: 'linear-gradient(135deg,#FFD700,#FF6B6B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {config.ruleta_titulo}
        </h1>
        {config.ruleta_descripcion && <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>{config.ruleta_descripcion}</p>}

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '6px 18px', borderRadius: 20, background: girosDisp > 0 ? 'rgba(255,215,0,.12)' : 'rgba(255,255,255,.04)', border: `1px solid ${girosDisp > 0 ? 'rgba(255,215,0,.4)' : 'rgba(255,255,255,.1)'}` }}>
          <span>{girosDisp > 0 ? '🎰' : '⏳'}</span>
          <span style={{ fontWeight: 700, color: girosDisp > 0 ? '#FFD700' : 'var(--text-muted)', fontSize: 14 }}>
            {girosDisp > 0 ? `${girosDisp} giro${girosDisp !== 1 ? 's' : ''} disponible${girosDisp !== 1 ? 's' : ''}` : 'Sin giros — completa un pedido para ganar uno'}
          </span>
        </div>
      </div>

      {/* Wheel area */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Pointer arrow */}
        <div style={{ zIndex: 10, marginBottom: -18, position: 'relative' }}>
          <div style={{ width: 0, height: 0, borderLeft: '14px solid transparent', borderRight: '14px solid transparent', borderTop: '30px solid #FF3333', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,.5))' }} />
          <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 6, height: 6, borderRadius: '50%', background: '#fff', marginTop: -4 }} />
        </div>

        {/* Wheel SVG */}
        <div style={{
          transform: `rotate(${rotation}deg)`,
          transition: animate ? 'transform 6s cubic-bezier(0.17,0.67,0.08,1)' : 'none',
          willChange: 'transform',
          borderRadius: '50%',
          boxShadow: '0 0 0 6px #0d1b4b, 0 0 0 10px #1a3a8f, 0 0 0 14px #FFD700, 0 16px 40px rgba(0,0,0,.6)'
        }}>
          <svg viewBox="0 0 300 300" width={wheelSize} height={wheelSize} style={{ display: 'block' }}>
            <defs>
              <radialGradient id="hubG" cx="40%" cy="35%"><stop offset="0%" stopColor="#60a5fa" /><stop offset="100%" stopColor="#1e3a8a" /></radialGradient>
            </defs>

            {/* Outer decorative ring */}
            <circle cx={CX} cy={CY} r={R + 10} fill="#0d1b4b" />
            <circle cx={CX} cy={CY} r={R + 6}  fill="none" stroke="#FFD700" strokeWidth="2" strokeDasharray="5 3" />

            {segments.length === 0
              ? <circle cx={CX} cy={CY} r={R} fill="#1e2a4a" />
              : segments.map((seg, idx) => {
                  const t = polar(CX, CY, R_TEXT, seg.midAngle)
                  const rot = seg.midAngle > 180 ? seg.midAngle + 180 : seg.midAngle
                  const shortName = seg.nombre.length > 9 ? seg.nombre.slice(0, 9) + '…' : seg.nombre
                  return (
                    <g key={seg.id}>
                      <path d={arc(CX, CY, R, seg.startAngle, seg.endAngle)} fill={seg.color || seg.colorFallback} stroke="rgba(255,255,255,.2)" strokeWidth="1.5" />
                      <text x={t.x} y={t.y} textAnchor="middle" dominantBaseline="middle"
                        fontSize={segments.length > 8 ? 7.5 : 9} fontWeight="800" fill="white"
                        transform={`rotate(${rot},${t.x},${t.y})`}
                        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.8))' }}>
                        {seg.emoji || '🎁'} {shortName}
                      </text>
                    </g>
                  )
                })
            }

            {/* Center hub */}
            <circle cx={CX} cy={CY} r={R_INNER + 10} fill="#0d1b4b" />
            <circle cx={CX} cy={CY} r={R_INNER + 6}  fill="url(#hubG)" />
            <circle cx={CX} cy={CY} r={R_INNER}       fill="#1e3a8a" stroke="#FFD700" strokeWidth="2" />
            <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle" fontSize="22">⭐</text>
          </svg>
        </div>

        {/* Decorative base */}
        <div style={{ marginTop: -6, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 36, height: 56, background: 'linear-gradient(180deg,#1a3a8f,#0d1f5c)', borderRadius: '4px 4px 0 0' }} />
          <div style={{ width: 150, height: 24, background: 'linear-gradient(180deg,#1a3a8f,#0d1f5c)', borderRadius: '6px 6px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {[...Array(6)].map((_, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFD700', boxShadow: '0 0 8px #FFD700' }} />)}
          </div>
          <div style={{ width: 180, height: 12, background: '#07123d', borderRadius: '0 0 8px 8px' }} />
        </div>

        {/* Spin button */}
        <button onClick={handleSpin} disabled={spinning || girosDisp <= 0 || segments.length === 0}
          style={{
            marginTop: 24, padding: '14px 52px', fontSize: 18, fontWeight: 900,
            borderRadius: 50, border: 'none',
            cursor: spinning || girosDisp <= 0 ? 'not-allowed' : 'pointer',
            background: spinning || girosDisp <= 0 ? 'rgba(255,255,255,.07)' : 'linear-gradient(135deg,#FFD700,#FF8C00)',
            color: spinning || girosDisp <= 0 ? 'var(--text-muted)' : '#1a1a2e',
            transition: 'all .3s',
            boxShadow: spinning || girosDisp <= 0 ? 'none' : '0 8px 28px rgba(255,215,0,.45)',
            letterSpacing: 1,
            animation: girosDisp > 0 && !spinning ? 'spinBtn 2s infinite' : 'none'
          }}>
          {spinning ? '🌀 Girando...' : girosDisp > 0 ? '🎰 ¡GIRAR!' : '🔒 Sin Giros'}
        </button>
        {segments.length === 0 && !loading && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>No hay premios configurados aún.</p>
        )}
      </div>

      {/* Spin history */}
      {historial.length > 0 && (
        <div className="card" style={{ marginTop: 32, padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>🏆 Mis últimos premios</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {historial.map((h, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{h.premio_nombre}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {h.tipo === 'saldo_usd' && h.valor > 0 && <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 13 }}>+{formatUSD(h.valor)}</span>}
                  {h.tipo === 'saldo_bs'  && h.valor > 0 && <span style={{ color: '#a855f7', fontWeight: 700, fontSize: 13 }}>+{formatBs(h.valor)}</span>}
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{new Date(h.created_at).toLocaleDateString('es-VE')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result Modal */}
      {showModal && resultado && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50000, background: 'rgba(0,0,0,.88)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowModal(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 28, padding: '36px 32px', maxWidth: 420, width: '100%', textAlign: 'center', border: '1px solid rgba(255,215,0,.3)', boxShadow: '0 30px 60px rgba(0,0,0,.8)', animation: 'winPop .5s cubic-bezier(.175,.885,.32,1.275)' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ fontSize: 72, marginBottom: 12, display: 'block' }}>{resultado.tipo === 'sin_premio' ? '😅' : resultado.emoji || '🎁'}</div>

            <h2 style={{
              fontSize: 26, fontWeight: 900, marginBottom: 8,
              ...(resultado.tipo !== 'sin_premio' ? { background: 'linear-gradient(135deg,#FFD700,#FF8C00)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : { color: 'var(--text-muted)' })
            }}>
              {resultado.tipo === 'sin_premio' ? '¡Suerte la próxima!' : '¡Felicidades! 🎉'}
            </h2>

            <div style={{ padding: '16px 20px', borderRadius: 16, background: resultado.tipo === 'sin_premio' ? 'rgba(255,255,255,.03)' : 'rgba(255,215,0,.07)', border: `1px solid ${resultado.tipo === 'sin_premio' ? 'rgba(255,255,255,.08)' : 'rgba(255,215,0,.25)'}`, marginBottom: 20 }}>
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{resultado.premio_nombre}</div>
              {resultado.valor > 0 && resultado.tipo === 'saldo_usd' && (
                <div style={{ fontSize: 32, fontWeight: 900, color: '#22c55e' }}>+{formatUSD(resultado.valor)}</div>
              )}
              {resultado.valor > 0 && resultado.tipo === 'saldo_bs' && (
                <div style={{ fontSize: 32, fontWeight: 900, color: '#a855f7' }}>+{formatBs(resultado.valor)}</div>
              )}
              {resultado.acreditado && resultado.tipo !== 'descuento' && (
                <div style={{ color: '#22c55e', fontSize: 13, marginTop: 6 }}>✅ Acreditado a tu billetera</div>
              )}
              {resultado.tipo === 'descuento' && (
                <div style={{ color: '#FFD700', fontSize: 13, marginTop: 6 }}>✅ Guardado para tu próxima compra</div>
              )}
              {resultado.premio_descripcion && <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8, marginBottom: 0 }}>{resultado.premio_descripcion}</p>}
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
              Giros restantes: <strong style={{ color: 'var(--text-primary)' }}>{resultado.giros_restantes ?? girosDisp}</strong>
            </p>

            <button className="btn btn-primary" style={{ width: '100%', height: 50, fontSize: 16 }} onClick={() => setShowModal(false)}>
              {(resultado.giros_restantes ?? girosDisp) > 0 ? '🎰 Girar de nuevo' : '✅ Cerrar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
