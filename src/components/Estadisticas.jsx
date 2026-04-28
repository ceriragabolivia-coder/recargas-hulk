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
    totales: { usuarios: 0, pedidos: 0, hoy: 0 }
  });

  const [range, setRange] = useState({
    inicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    fin: new Date().toISOString().split('T')[0],
    agrupacion: 'day'
  });

  const fetchData = async () => {
    if (perfil?.rol?.toLowerCase() !== 'admin') return;
    setLoading(true);
    try {
      // 1. Datos Totales (Directo de tablas)
      const [resUsers, resOrders, resToday] = await Promise.all([
        supabase.from('perfiles').select('id', { count: 'exact', head: true }),
        supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('estado', 'completado'),
        supabase.from('perfiles').select('id', { count: 'exact', head: true }).gte('created_at', new Date().toISOString().split('T')[0])
      ]);

      // 2. Gráficas via RPC
      const { data: chartData } = await supabase.rpc('get_admin_stats', {
        p_fecha_inicio: range.inicio + 'T00:00:00Z',
        p_fecha_fin: range.fin + 'T23:59:59Z',
        p_agrupacion: range.agrupacion
      });

      // 3. Fallback para gráficas de registros si el RPC no devuelve nada
      let registrosData = chartData?.registros || [];
      if (registrosData.length === 0 && resUsers.count > 0) {
        // Mock simple o consulta directa si falla el agrupamiento
        registrosData = [{ fecha: new Date().toISOString(), cantidad: resUsers.count }];
      }

      setStats({
        registros: registrosData,
        logins: chartData?.logins || [],
        pedidos: chartData?.pedidos || [],
        totales: {
          usuarios: resUsers.count || 0,
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
    
    // Escuchar el evento de la campanita
    const handleOnlineUpdate = (e) => setOnlineRealtime(e.detail);
    window.addEventListener('online-users-update', handleOnlineUpdate);
    
    const interval = setInterval(fetchData, 45000);
    return () => {
      window.removeEventListener('online-users-update', handleOnlineUpdate);
      clearInterval(interval);
    };
  }, [range, perfil?.id]);

  const formatFecha = (str) => {
    if (!str) return '';
    const d = new Date(str);
    return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="page-content animated fadeIn">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ color: 'var(--accent-primary)', marginBottom: '4px' }}>Estadísticas Pro 📈</h1>
          <p style={{ color: 'var(--text-muted)' }}>Métricas en tiempo real sincronizadas</p>
        </div>

        <div className="glass-morphism" style={{ padding: '12px 20px', borderRadius: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select 
            value={range.agrupacion} 
            onChange={e => setRange(prev => ({...prev, agrupacion: e.target.value}))}
            className="input-search"
            style={{ width: '120px', background: 'rgba(0,0,0,0.2)' }}
          >
            <option value="day">Diario</option>
            <option value="week">Semanal</option>
            <option value="month">Mensual</option>
          </select>
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
                <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 22, 0.95)', border: '1px solid var(--border-color)', borderRadius: '12px' }} labelFormatter={formatFecha} />
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
                <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 22, 0.95)', border: '1px solid var(--border-color)', borderRadius: '12px' }} labelFormatter={formatFecha} />
                <Bar dataKey="cantidad" name="Logins" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
