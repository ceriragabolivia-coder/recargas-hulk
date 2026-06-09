import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useData';

export default function Estadisticas() {
  const { perfil } = useAuth();
  const [loading, setLoading] = useState(true);
  const [onlineRealtime, setOnlineRealtime] = useState(0);
  const [stats, setStats] = useState({
    registros: [],
    logins: [],
    pedidos: [],
    tracking: [],
    totales: { usuarios: 0, pedidos: 0, hoy: 0 }
  });

  const [timeRange, setTimeRange] = useState('30d');
  const [range, setRange] = useState({
    inicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    fin: new Date().toISOString().split('T')[0],
    agrupacion: 'day'
  });

  const fetchData = async () => {
    if (perfil?.rol?.toLowerCase() !== 'admin') return;
    setLoading(true);
    try {
      let inicioDate = null;
      if (timeRange === '7d') inicioDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      else if (timeRange === '30d') inicioDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      else if (timeRange === '90d') inicioDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      // else if 'all' then inicioDate = null

      const finDate = new Date().toISOString();

      // 1. Datos Totales (Directo de tablas para máxima precisión)
      const [resOrders, resToday] = await Promise.all([
        supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('estado', 'completado'),
        supabase.from('clientes').select('id', { count: 'exact', head: true }).gte('fecha_registro', new Date().toISOString().split('T')[0])
      ]);

      // 2. Gráficas via RPC
      const { data: chartData } = await supabase.rpc('get_admin_stats', {
        p_fecha_inicio: inicioDate,
        p_fecha_fin: finDate,
        p_agrupacion: range.agrupacion
      });

      // 3. Tracking Data
      const { data: trackingData } = await supabase.rpc('get_tracking_stats', {
        p_fecha_inicio: inicioDate
      });

      setStats({
        registros: chartData?.registros || [],
        logins: chartData?.logins || [],
        pedidos: chartData?.pedidos || [],
        tracking: trackingData || [],
        totales: {
          usuarios: chartData?.total_usuarios || 0, // Ahora viene del RPC sincronizado
          pedidos: resOrders.count || 0,
          hoy: resToday.count || 0
        }
      });
    } catch (err) {
      console.error("Error cargando estadísticas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    const handleOnlineUpdate = (e) => setOnlineRealtime(e.detail);
    window.addEventListener('online-users-update', handleOnlineUpdate);
    
    const interval = setInterval(fetchData, 45000);
    return () => {
      window.removeEventListener('online-users-update', handleOnlineUpdate);
      clearInterval(interval);
    };
  }, [timeRange, range.agrupacion, perfil?.id]);

  const formatFecha = (str) => {
    if (!str) return '';
    const d = new Date(str);
    if (range.agrupacion === 'month') {
      return d.toLocaleDateString('es-VE', { month: 'short', year: '2-digit' });
    }
    if (range.agrupacion === 'week') {
      // Obtener el número de semana aproximado
      const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
      const pastDaysOfYear = (d - firstDayOfYear) / 86400000;
      const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
      return `Sem ${weekNum}`;
    }
    return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' });
  };

  const formatFechaFull = (str) => {
    if (!str) return '';
    const d = new Date(str);
    return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  return (
    <div className="page-content animated fadeIn">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ color: 'var(--accent-primary)', marginBottom: '4px' }}>Estadísticas Pro 📈</h1>
          <p style={{ color: 'var(--text-muted)' }}>Métricas en tiempo real sincronizadas</p>
        </div>

        <div className="glass-morphism" style={{ padding: '12px 20px', borderRadius: '16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Rango:</span>
            <select 
              value={timeRange} 
              onChange={e => setTimeRange(e.target.value)}
              className="input-search"
              style={{ width: '130px', background: 'rgba(0,0,0,0.2)' }}
            >
              <option value="7d">Últimos 7 días</option>
              <option value="30d">Últimos 30 días</option>
              <option value="90d">Últimos 90 días</option>
              <option value="all">Todo el tiempo</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Vista:</span>
            <select 
              value={range.agrupacion} 
              onChange={e => setRange(prev => ({...prev, agrupacion: e.target.value}))}
              className="input-search"
              style={{ width: '110px', background: 'rgba(0,0,0,0.2)' }}
            >
              <option value="day">Diario</option>
              <option value="week">Semanal</option>
              <option value="month">Mensual</option>
            </select>
          </div>
          <button onClick={fetchData} className="btn btn-primary" style={{ padding: '8px 16px' }}>🔄 Refrescar</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {/* Usamos el valor de la campanita directamente */}
        <div className="card" style={{ textAlign: 'center', borderBottom: '4px solid var(--accent-success)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🟢</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'white' }}>{onlineRealtime}</div>
          <div style={{ fontSize: '12px', color: 'var(--accent-success)', fontWeight: 700, textTransform: 'uppercase' }}>En Línea Ahora</div>
        </div>
        <div className="card" style={{ textAlign: 'center', borderBottom: '4px solid var(--accent-primary)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>👥</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'white' }}>{stats.totales.usuarios}</div>
          <div style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: 700, textTransform: 'uppercase' }}>Total Usuarios</div>
        </div>
        <div className="card" style={{ textAlign: 'center', borderBottom: '4px solid #a855f7' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📦</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'white' }}>{stats.totales.pedidos}</div>
          <div style={{ fontSize: '12px', color: '#a855f7', fontWeight: 700, textTransform: 'uppercase' }}>Pedidos Exitosos</div>
        </div>
        <div className="card" style={{ textAlign: 'center', borderBottom: '4px solid #ffc107' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🆕</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'white' }}>{stats.totales.hoy}</div>
          <div style={{ fontSize: '12px', color: '#ffc107', fontWeight: 700, textTransform: 'uppercase' }}>Nuevos Hoy</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ color: 'white', marginBottom: '20px' }}>📈 Crecimiento (Registros)</h3>
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer>
              <AreaChart data={stats.registros}>
                <defs>
                  <linearGradient id="colorReg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="fecha" tickFormatter={formatFecha} stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 22, 0.95)', border: '1px solid var(--border-color)', borderRadius: '12px' }} labelFormatter={formatFechaFull} />
                <Area type="monotone" dataKey="cantidad" name="Registros" stroke="var(--accent-primary)" fill="url(#colorReg)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ color: 'white', marginBottom: '20px' }}>🔑 Actividad de Logins</h3>
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer>
              <BarChart data={stats.logins}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="fecha" tickFormatter={formatFecha} stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 22, 0.95)', border: '1px solid var(--border-color)', borderRadius: '12px' }} labelFormatter={formatFechaFull} />
                <Bar dataKey="cantidad" name="Logins" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* TRACKING MODULE */}
      <div style={{ marginTop: '32px' }}>
        <h2 style={{ color: 'white', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🎯 Páginas y Servicios Más Visitados
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          
          {/* Top Global */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ color: 'var(--accent-primary)', marginBottom: '16px', fontSize: '16px' }}>🏆 Top Global</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {stats.tracking && stats.tracking.length > 0 ? [...stats.tracking].sort((a,b) => b.total_count - a.total_count).slice(0, 5).map((t, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(0, 210, 255, 0.05)', borderRadius: '12px', border: '1px solid rgba(0, 210, 255, 0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-primary)', width: '20px' }}>{idx+1}.</span>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{t.item_nombre}</span>
                  </div>
                  <span style={{ fontWeight: 800, background: 'var(--accent-primary)', color: '#000', padding: '4px 10px', borderRadius: '20px', fontSize: '12px' }}>{t.total_count}</span>
                </div>
              )) : <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No hay datos suficientes en este rango.</div>}
            </div>
          </div>

          {/* Top Logged In */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ color: '#22c55e', marginBottom: '16px', fontSize: '16px' }}>👤 Top Usuarios Logueados</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {stats.tracking && stats.tracking.length > 0 ? [...stats.tracking].sort((a,b) => b.logged_count - a.logged_count).slice(0, 5).map((t, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(34, 197, 94, 0.05)', borderRadius: '12px', border: '1px solid rgba(34, 197, 94, 0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 800, color: '#22c55e', width: '20px' }}>{idx+1}.</span>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{t.item_nombre}</span>
                  </div>
                  <span style={{ fontWeight: 800, background: '#22c55e', color: '#000', padding: '4px 10px', borderRadius: '20px', fontSize: '12px' }}>{t.logged_count}</span>
                </div>
              )) : <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No hay datos suficientes en este rango.</div>}
            </div>
          </div>

          {/* Top Guests */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ color: '#a855f7', marginBottom: '16px', fontSize: '16px' }}>👀 Top Visitantes (No Registrados)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {stats.tracking && stats.tracking.length > 0 ? [...stats.tracking].sort((a,b) => b.guest_count - a.guest_count).slice(0, 5).map((t, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(168, 85, 247, 0.05)', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 800, color: '#a855f7', width: '20px' }}>{idx+1}.</span>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{t.item_nombre}</span>
                  </div>
                  <span style={{ fontWeight: 800, background: '#a855f7', color: '#fff', padding: '4px 10px', borderRadius: '20px', fontSize: '12px' }}>{t.guest_count}</span>
                </div>
              )) : <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No hay datos suficientes en este rango.</div>}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
