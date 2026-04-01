import React, { useState, useEffect, useMemo } from 'react'
import { useVentas } from '../hooks/useData'
import { formatBs, formatUSD, getLocalDateString } from '../utils/helpers'

export default function Reportes() {
  const { fetchHistorial } = useVentas()
  
  // Default to current month based on Local Time
  const today = new Date()
  const firstDay = getLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1))
  const lastDay = getLocalDateString(today)

  const [fechaDesde, setFechaDesde] = useState(firstDay)
  const [fechaHasta, setFechaHasta] = useState(lastDay)
  
  const [loading, setLoading] = useState(false)
  const [ventas, setVentas] = useState([])

  const generarReporte = async () => {
    setLoading(true)
    const data = await fetchHistorial(fechaDesde, fechaHasta)
    setVentas(data || [])
    setLoading(false)
  }

  // Load initially
  useEffect(() => {
    // eslint-disable-next-line
    generarReporte()
  }, [])

  const stats = useMemo(() => {
    let transacciones = ventas.length
    let totalUnidades = 0
    let totalGanancias = 0
    let totalIngresosBs = 0
    let totalIngresosUsd = 0
    
    const juegosMap = {}
    const productosMap = {}

    ventas.forEach(v => {
      const cant = Number(v.cantidad || 1)
      totalUnidades += cant
      totalGanancias += Number(v.ganancia_usd || 0)
      totalIngresosBs += Number(v.precio_venta_bs || 0)
      totalIngresosUsd += Number(v.precio_venta_usd || 0)

      const jName = v.juegos?.nombre || 'Ventas Libres'
      const pName = v.productos?.nombre || v.notas || 'Venta Manual'

      if (!juegosMap[jName]) juegosMap[jName] = { nombre: jName, unidades: 0, ganancia: 0 }
      juegosMap[jName].unidades += cant
      juegosMap[jName].ganancia += Number(v.ganancia_usd || 0)

      if (!productosMap[pName]) productosMap[pName] = { nombre: pName, juego: jName, unidades: 0, ganancia: 0 }
      productosMap[pName].unidades += cant
      productosMap[pName].ganancia += Number(v.ganancia_usd || 0)
    })

    const topJuegos = Object.values(juegosMap).sort((a, b) => b.unidades - a.unidades)
    const topProductos = Object.values(productosMap).sort((a, b) => b.unidades - a.unidades)

    return { transacciones, totalUnidades, totalGanancias, totalIngresosBs, totalIngresosUsd, topJuegos, topProductos }
  }, [ventas])

  return (
    <div>
      <div className="page-header mb-24">
        <h1 className="page-title">Reportes y Analíticas</h1>
        <p className="page-subtitle">Rendimiento de ventas por juegos y productos</p>
      </div>

      <div className="card mb-24" style={{ padding: '20px' }}>
        <div className="flex gap-16" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: 13, marginBottom: 8 }}>Desde</label>
            <input type="date" className="form-input" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: 13, marginBottom: 8 }}>Hasta</label>
            <input type="date" className="form-input" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
          </div>
          <div style={{ flex: '0 0 auto' }}>
            <button className="btn btn-primary" onClick={generarReporte} disabled={loading} style={{ height: '42px', padding: '0 32px' }}>
              {loading ? 'Generando...' : 'Generar Reporte'}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="spinner"></div>
        </div>
      ) : (
        <>
          <div className="kpi-grid mb-24">
            <div className="kpi-card">
              <div className="kpi-label">Transacciones y Unidades</div>
              <div className="kpi-value">{stats.transacciones} <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>trx</span></div>
              <div className="kpi-change" style={{ color: 'var(--accent-secondary)' }}>{stats.totalUnidades} unidades vendidas</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Ingresos Brutos Periodo (USD)</div>
              <div className="kpi-value">{formatUSD(stats.totalIngresosUsd)}</div>
              <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>{formatBs(stats.totalIngresosBs)} Bs</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Ganancia Neta Periodo (USD)</div>
              <div className="kpi-value" style={{ color: 'var(--accent-success)' }}>{formatUSD(stats.totalGanancias)}</div>
              <div className="kpi-change">Métrica clave de rendimiento</div>
            </div>
          </div>

          <div className="flex gap-24" style={{ flexWrap: 'wrap' }}>
            {/* Top Juegos */}
            <div className="card" style={{ flex: '1 1 400px' }}>
              <div className="card-header">
                <div className="card-title">Juegos / Servicios Más Vendidos</div>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Juego / Servicio</th>
                      <th style={{ textAlign: 'center' }}>Unidades</th>
                      <th style={{ textAlign: 'right' }}>Ganancia Generada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topJuegos.length === 0 ? (
                      <tr><td colSpan="3" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No hay datos para este período</td></tr>
                    ) : (
                      stats.topJuegos.map((j, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{j.nombre}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ backgroundColor: 'rgba(0, 210, 255, 0.1)', color: 'var(--accent-primary)', padding: '4px 14px', borderRadius: '12px', fontWeight: 'bold' }}>
                              {j.unidades}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--accent-success)', fontWeight: 600, fontSize: 15 }}>
                            {formatUSD(j.ganancia)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Productos */}
            <div className="card" style={{ flex: '1 1 400px' }}>
              <div className="card-header">
                <div className="card-title">Productos Más Vendidos</div>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th style={{ textAlign: 'center' }}>Unidades</th>
                      <th style={{ textAlign: 'right' }}>Ganancia Generada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topProductos.length === 0 ? (
                      <tr><td colSpan="3" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No hay datos para este período</td></tr>
                    ) : (
                      stats.topProductos.slice(0, 20).map((p, idx) => ( // Mostrar el top 20
                        <tr key={idx}>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.nombre}</div>
                            <div style={{ fontSize: 11, color: 'var(--accent-secondary)' }}>{p.juego}</div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ backgroundColor: 'rgba(123, 47, 247, 0.1)', color: 'var(--accent-secondary)', padding: '4px 14px', borderRadius: '12px', fontWeight: 'bold' }}>
                              {p.unidades}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--accent-success)', fontWeight: 600, fontSize: 13 }}>
                            {formatUSD(p.ganancia)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
