import React, { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { useVentas, useConfiguracion, useTodosLosProductos, useJuegos, useProductos, useAuth } from '../hooks/useData'
import { formatUSD, formatBs, calcularPrecioVenta, getLocalDateString, playCashRegisterSound } from '../utils/helpers'

const COLORS = ['#00d2ff', '#7b2ff7', '#00f5d4', '#ffd166', '#ff6b6b']


function QuickSaleWidget({ onSaleComplete, config }) {
  const { productos, loading } = useTodosLosProductos()
  const { registrarVenta } = useVentas()

  const [selectedProdId, setSelectedProdId] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const filteredProducts = React.useMemo(() => {
    if (!searchTerm) return productos
    return productos.filter(p => {
      const matchName = p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
      const matchJuego = (p.juegos?.nombre || '').toLowerCase().includes(searchTerm.toLowerCase())
      return matchName || matchJuego
    })
  }, [productos, searchTerm])

  const handleVender = async (e) => {
    e.preventDefault()
    if (!selectedProdId) return
    setIsSubmitting(true)
    const { error } = await registrarVenta(selectedProdId, cantidad, '')
    setIsSubmitting(false)
    if (!error) {
      playCashRegisterSound()
      setSuccessMsg('¡Venta registrada!')
      setTimeout(() => setSuccessMsg(''), 3000)
      setCantidad(1)
      setSelectedProdId('')
      setSearchTerm('')
      if (onSaleComplete) onSaleComplete()
    } else {
      alert('Error: ' + error.message)
    }
  }

  const selectedProd = productos.find(p => p.id === selectedProdId)
  let precioText = ''
  if (selectedProd && config && Object.keys(config).length > 0) {
     const p = calcularPrecioVenta(selectedProd, selectedProd.juegos, config)
     precioText = `Bs ${p.venta_bs} / $${p.venta_usd}`
  }

  return (
    <div className="card" style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column' }}>
      <div className="card-header">
        <div className="card-title">Venta Rápida</div>
      </div>
      <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div className="spinner"></div>
          </div>
        ) : (
          <form onSubmit={handleVender} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontSize: 13, marginBottom: 8 }}>Producto o Servicio</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%' }}
                  placeholder="Buscar juego o producto..."
                  value={searchTerm}
                  onChange={e => {
                    setSearchTerm(e.target.value)
                    setIsDropdownOpen(true)
                    setSelectedProdId('')
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                  required={!selectedProdId}
                />
                {isDropdownOpen && (
                  <div style={{ 
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, 
                    backgroundColor: '#1A1E2D', /* Color oscuro sólido para evitar transparencia */
                    border: '1px solid var(--accent-primary)', /* Borde resaltado */
                    borderRadius: '8px', maxHeight: '250px', overflowY: 'auto', 
                    marginTop: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.8)' 
                  }}>
                    {filteredProducts.length === 0 ? (
                      <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>No se encontraron productos</div>
                    ) : (
                      filteredProducts.map(p => (
                        <div 
                          key={p.id}
                          onClick={() => {
                            setSelectedProdId(p.id)
                            setSearchTerm(`${p.juegos?.nombre || 'Otros'} - ${p.nombre}`)
                            setIsDropdownOpen(false)
                          }}
                          style={{ 
                            padding: '12px 16px', cursor: 'pointer', 
                            borderBottom: '1px solid rgba(255,255,255,0.03)', 
                            fontSize: 14, display: 'flex', flexDirection: 'column',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = 'rgba(0, 210, 255, 0.1)'
                            e.currentTarget.style.paddingLeft = '20px'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                            e.currentTarget.style.paddingLeft = '16px'
                          }}
                        >
                          <span style={{ color: 'var(--accent-primary)', fontSize: 11, fontWeight: 700, marginBottom: 4, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                            {p.juegos?.nombre || 'Otros'}
                          </span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                            {p.nombre}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {selectedProd && (
              <div style={{ fontSize: 13, color: 'var(--accent-success)', marginBottom: 16, fontWeight: 600 }}>
                Precio final: {precioText}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label" style={{ fontSize: 13, marginBottom: 8 }}>Cantidad</label>
              <input type="number" min="1" className="form-input" value={cantidad} onChange={e => setCantidad(parseInt(e.target.value)||1)} required />
            </div>

            <div style={{ marginTop: 'auto' }}>
              {successMsg ? (
                <div style={{ color: 'var(--accent-success)', textAlign: 'center', fontWeight: 'bold', padding: '10px 0', border: '1px solid var(--accent-success)', borderRadius: '8px', backgroundColor: 'rgba(0, 245, 212, 0.1)' }}>
                  ✅ {successMsg}
                </div>
              ) : (
                <button type="submit" className="btn btn-primary w-full" disabled={!selectedProdId || isSubmitting}>
                  {isSubmitting ? 'Registrando...' : '⚡ Registrar Venta'}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function QuickProductWidget({ config }) {
  const { juegos, loading: loadingJuegos } = useJuegos()
  const [selectedJuegoId, setSelectedJuegoId] = useState('')
  const { createProducto } = useProductos(selectedJuegoId)

  const [formData, setFormData] = useState({
    nombre: '',
    costo_base: '',
    margen_ganancia: '30'
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const filteredJuegos = React.useMemo(() => {
    if (!searchTerm) return juegos
    return juegos.filter(j => j.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [juegos, searchTerm])

  const selectedJuego = juegos.find(j => j.id === selectedJuegoId)

  const preview = () => {
    if (!selectedJuego || !config || !formData.costo_base) return null
    return calcularPrecioVenta(
      { costo_base: parseFloat(formData.costo_base), margen_ganancia: parseFloat(formData.margen_ganancia) / 100 },
      selectedJuego,
      config
    )
  }

  const handleCrear = async (e) => {
    e.preventDefault()
    if (!selectedJuegoId) return
    setIsSubmitting(true)
    const { error } = await createProducto({
      nombre: formData.nombre,
      costo_base: parseFloat(formData.costo_base),
      margen_ganancia: parseFloat(formData.margen_ganancia) / 100
    })
    setIsSubmitting(false)
    if (!error) {
      setSuccessMsg('¡Producto creado!')
      setTimeout(() => setSuccessMsg(''), 3000)
      setFormData({ nombre: '', costo_base: '', margen_ganancia: '30' })
      setSelectedJuegoId('')
      setSearchTerm('')
    } else {
      alert('Error: ' + error.message)
    }
  }

  const calculo = preview()

  return (
    <div className="card" style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column' }}>
      <div className="card-header">
        <div className="card-title">Añadir Producto Rápido</div>
      </div>
      <div style={{ padding: '20px', flex: 1 }}>
        {loadingJuegos ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><div className="spinner"></div></div>
        ) : (
          <form onSubmit={handleCrear}>
            <div className="form-group mb-12">
              <label className="form-label" style={{ fontSize: 12 }}>Juego / Servicio</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%' }}
                  placeholder="Escribe para buscar juego..."
                  value={searchTerm}
                  onChange={e => {
                    setSearchTerm(e.target.value)
                    setIsDropdownOpen(true)
                    setSelectedJuegoId('')
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                  required={!selectedJuegoId}
                />
                {isDropdownOpen && (
                  <div style={{ 
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60, 
                    backgroundColor: '#1A1E2D',
                    border: '1px solid var(--accent-primary)',
                    borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', 
                    marginTop: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.8)' 
                  }}>
                    {filteredJuegos.length === 0 ? (
                      <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>No se encontraron juegos</div>
                    ) : (
                      filteredJuegos.map(j => (
                        <div 
                          key={j.id}
                          onClick={() => {
                            setSelectedJuegoId(j.id)
                            setSearchTerm(j.nombre)
                            setIsDropdownOpen(false)
                          }}
                          style={{ 
                            padding: '10px 16px', cursor: 'pointer', 
                            borderBottom: '1px solid rgba(255,255,255,0.03)', 
                            fontSize: 13, color: 'var(--text-primary)',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0, 210, 255, 0.1)'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          {j.nombre}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="form-group mb-12">
              <label className="form-label" style={{ fontSize: 12 }}>Nombre del Pack</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Ej: 100 Diamantes"
                value={formData.nombre}
                onChange={e => setFormData({...formData, nombre: e.target.value})}
                required
              />
            </div>

            <div className="flex gap-12 mb-16">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Costo ($)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-input" 
                  placeholder="0.00"
                  value={formData.costo_base}
                  onChange={e => setFormData({...formData, costo_base: e.target.value})}
                  required
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Margen (%)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={formData.margen_ganancia}
                  onChange={e => setFormData({...formData, margen_ganancia: e.target.value})}
                  required
                />
              </div>
            </div>

            {calculo && (
              <div style={{ background: 'rgba(0, 210, 255, 0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(0,210,255,0.1)', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Precio Sugerido:</span>
                  <span style={{ color: 'var(--accent-success)', fontWeight: 'bold' }}>{formatBs(calculo.venta_bs)} / {formatUSD(calculo.venta_usd)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Ganancia neta:</span>
                  <span style={{ color: 'var(--accent-warning)' }}>{formatUSD(calculo.ganancia_usd)}</span>
                </div>
              </div>
            )}

            {successMsg ? (
              <div style={{ color: 'var(--accent-success)', textAlign: 'center', fontWeight: 'bold', padding: '10px 0', border: '1px solid var(--accent-success)', borderRadius: '8px', backgroundColor: 'rgba(0, 245, 212, 0.1)' }}>
                ✅ {successMsg}
              </div>
            ) : (
              <button type="submit" className="btn btn-ghost w-full" style={{ borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)', height: '42px', fontWeight: 600 }} disabled={isSubmitting || !selectedJuegoId}>
                {isSubmitting ? 'Guardando...' : '+ Crear Producto'}
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

function QuickManualSaleWidget({ onSaleComplete, config }) {
  const { registrarVentaManual } = useVentas()
  const [concepto, setConcepto] = useState('')
  const [ganancia, setGanancia] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const handleVender = async (e) => {
    e.preventDefault()
    if (!concepto || !ganancia) return
    setIsSubmitting(true)
    const { error } = await registrarVentaManual(concepto, ganancia, config)
    setIsSubmitting(false)
    if (!error) {
      playCashRegisterSound()
      setSuccessMsg('¡Venta registrada!')
      setTimeout(() => setSuccessMsg(''), 3000)
      setConcepto('')
      setGanancia('')
      if (onSaleComplete) onSaleComplete()
    } else {
      alert('Error: ' + error.message)
    }
  }

  return (
    <div className="card" style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column' }}>
      <div className="card-header">
        <div className="card-title">Venta Libre (Otros)</div>
      </div>
      <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <form onSubmit={handleVender} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label" style={{ fontSize: 13, marginBottom: 8 }}>Concepto / Servicio</label>
            <input
              type="text"
              className="form-input"
              style={{ width: '100%' }}
              placeholder="Ej: Mantenimiento PC"
              value={concepto}
              onChange={e => setConcepto(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ fontSize: 13, marginBottom: 8 }}>Ganancia ($)</label>
            <input 
              type="number" 
              step="0.01"
              min="0"
              className="form-input" 
              placeholder="0.00"
              value={ganancia} 
              onChange={e => setGanancia(e.target.value)} 
              required 
            />
          </div>

          <div style={{ marginTop: 'auto' }}>
            {successMsg ? (
              <div style={{ color: 'var(--accent-success)', textAlign: 'center', fontWeight: 'bold', padding: '10px 0', border: '1px solid var(--accent-success)', borderRadius: '8px', backgroundColor: 'rgba(0, 245, 212, 0.1)' }}>
                ✅ {successMsg}
              </div>
            ) : (
              <button type="submit" className="btn btn-primary w-full" disabled={!concepto || !ganancia || isSubmitting}>
                {isSubmitting ? 'Registrando...' : '⚡ Registrar Venta'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { resumen, loading: loadingVentas, fetchResumenPeriodo, fetchHistorial, limpiarComprobantes, refetch: refetchVentas } = useVentas()
  const { config, loading: loadingConfig, updateConfig } = useConfiguracion()
  const { perfil } = useAuth()
  const isAdmin = perfil?.rol?.toLowerCase() === 'admin'

  const [isEditingTasa, setIsEditingTasa] = useState(false)
  const [nuevaTasa, setNuevaTasa] = useState('')
  const [savingTasa, setSavingTasa] = useState(false)

  const [dataLine, setDataLine] = useState([])
  const [refreshKey, setRefreshKey] = useState(0) // Used to trigger refresh
  const [rangoFechas, setRangoFechas] = useState('7d')
  const [loadingCharts, setLoadingCharts] = useState(true)

  // Limpieza automática de comprobantes antiguos (> 20 días)
  React.useEffect(() => {
    if (isAdmin && limpiarComprobantes) {
      limpiarComprobantes()
    }
  }, [isAdmin, limpiarComprobantes])

  const handleSaveTasa = async () => {
    if (!nuevaTasa) return
    setSavingTasa(true)
    await updateConfig('tasa_dolar', nuevaTasa)
    setSavingTasa(false)
    setIsEditingTasa(false)
  }

  React.useEffect(() => {
    async function loadCharts() {
      setLoadingCharts(true)
      const hoyLocal = getLocalDateString(new Date())
      const fechaDesde = new Date()
      let diasRango = 6

      if (rangoFechas === '7d') diasRango = 6
      else if (rangoFechas === '15d') diasRango = 14
      else if (rangoFechas === '30d') diasRango = 29

      fechaDesde.setDate(new Date().getDate() - diasRango)
      
      const fDesde = getLocalDateString(fechaDesde)
      const fHasta = hoyLocal

      const [resumenes] = await Promise.all([
        fetchResumenPeriodo(fDesde, fHasta)
      ])

      const diasNombres = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
      const newLineData = []
      
      for (let i = diasRango; i >= 0; i--) {
        const d = new Date()
        d.setDate(new Date().getDate() - i)
        // ensure we match local dates accurately
        const fechaStr = getLocalDateString(d)
        const registro = resumenes.find(r => r.fecha === fechaStr)

        let label = diasNombres[d.getDay()]
        if (diasRango > 6) {
          label = `${d.getDate()}/${d.getMonth() + 1}`
        }

        newLineData.push({
          name: label,
          ganancia: registro ? Number(registro.ganancias_totales || 0) : 0
        })
      }
      setDataLine(newLineData)

      // (Gráfico circular eliminado por funcionalidad de Venta Rápida)
      setLoadingCharts(false)
    }
    loadCharts()
  }, [rangoFechas, refreshKey])

  if (loadingVentas || loadingConfig || (loadingCharts && dataLine.length === 0)) {
    return (
      <div className="loading-page">
        <div className="spinner"></div><div>Cargando dashboard...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header mb-24" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Resumen general de tu centro de recargas</p>
        </div>
      </div>

      <div className="page-content" style={{ paddingTop: 0 }}>
        
        {/* KPIs */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Ganancias Hoy (USD)</div>
            <div className="kpi-value">{formatUSD(resumen?.ganancias_totales || 0)}</div>
            <div className="kpi-change">Métricas en vivo</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Recargas Totales Hoy</div>
            <div className="kpi-value">{resumen?.recargas_totales || 0}</div>
            <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>Transacciones</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Ventas Totales Hoy (Bs)</div>
            <div className="kpi-value">{formatBs(resumen?.ventas_totales_bs || 0)}</div>
          </div>
          <div className="kpi-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="flex justify-between items-center mb-8">
              <div className="kpi-label" style={{ margin: 0 }}>Tasa Oficial Actual</div>
              {!isEditingTasa ? (
                <button 
                  className="btn btn-ghost btn-sm" 
                  style={{ padding: '2px 8px', fontSize: 11 }} 
                  onClick={() => { setNuevaTasa(config.tasa_dolar); setIsEditingTasa(true); }}
                >
                  ✎ Editar
                </button>
              ) : (
                <button 
                  className="btn btn-primary btn-sm" 
                  style={{ padding: '2px 8px', fontSize: 11 }} 
                  onClick={handleSaveTasa} 
                  disabled={savingTasa}
                >
                  {savingTasa ? '...' : '✓ Guardar'}
                </button>
              )}
            </div>
            
            {!isEditingTasa ? (
              <div className="kpi-value" style={{ fontSize: 24 }}>Bs {config.tasa_dolar}</div>
            ) : (
              <input 
                type="number" 
                className="form-input" 
                style={{ fontSize: 24, fontWeight: 'bold', padding: '4px 10px', width: '100%', marginBottom: 4 }} 
                value={nuevaTasa} 
                onChange={e => setNuevaTasa(e.target.value)} 
                autoFocus 
              />
            )}
            
            {/* Tasas eliminadas por solicitud del usuario */}
          </div>
        </div>

        {/* Gráficas y Accesos Rápidos */}
        <div className="flex gap-24" style={{ flexWrap: 'wrap', alignItems: 'stretch' }}>
          
          <div className="card" style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="flex items-center gap-8">
                <div className="card-title" style={{ fontSize: 14 }}>Tendencia de Ganancias</div>
                {loadingCharts && <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
              </div>
              <div className="flex items-center gap-12">
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total del período</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-success)', lineHeight: 1.2 }}>
                    {formatUSD(dataLine.reduce((sum, d) => sum + (d.ganancia || 0), 0))}
                  </div>
                </div>
                <select 
                  className="form-select" 
                  style={{ width: 'auto', padding: '4px 24px 4px 8px', fontSize: 12, backgroundColor: 'var(--bg-card)' }}
                  value={rangoFechas}
                  onChange={(e) => setRangoFechas(e.target.value)}
                  disabled={loadingCharts}
                >
                  <option value="7d">7 días</option>
                  <option value="15d">15 días</option>
                  <option value="30d">30 días</option>
                </select>
              </div>
            </div>
            <div style={{ flex: 1, height: '350px', minHeight: '350px', padding: '10px 0' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dataLine} margin={{ top: 10, right: 20, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-muted)" tick={{fill: 'var(--text-muted)', fontSize: 11}} dy={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" tickFormatter={(val) => `$${val}`} tick={{fill: 'var(--text-muted)', fontSize: 11}} dx={-10} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px', fontSize: 12 }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                    formatter={(value) => [`$${value}`, 'Ganancia']}
                  />
                  <Line type="monotone" dataKey="ganancia" stroke="var(--accent-primary)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <QuickSaleWidget 
            config={config} 
            onSaleComplete={() => {
              setRefreshKey(k => k + 1)
              if (refetchVentas) refetchVentas()
            }} 
          />

          <QuickProductWidget config={config} />

          <QuickManualSaleWidget 
            config={config} 
            onSaleComplete={() => {
              setRefreshKey(k => k + 1)
              if (refetchVentas) refetchVentas()
            }} 
          />

        </div>

      </div>
    </div>
  )
}
