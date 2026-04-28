import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useData';

export default function Estadisticas() {
  const { perfil } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [range, setRange] = useState({
    inicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    fin: new Date().toISOString().split('T')[0],
    agrupacion: 'day'
  });

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data: stats, error } = await supabase.rpc('get_admin_stats', {
        p_fecha_inicio: range.inicio + 'T00:00:00Z',
        p_fecha_fin: range.fin + 'T23:59:59Z',
        p_agrupacion: range.agrupacion
      });

      if (error) throw error;
      setData(stats);
    } catch (err) {
      console.error("Error al cargar estadísticas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (perfil?.rol?.toLowerCase() === 'admin') {
      fetchStats();
    }
  }, [range]);

  if (!data && loading) {
    return (
      <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

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
          <p style={{ color: 'var(--text-muted)' }}>Análisis detallado de actividad y crecimiento</p>
        </div>

        <div className="glass-morphism" style={{ padding: '12px 20px', borderRadius: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input 
            type="date" 
            value={range.inicio} 
            onChange={e => setRange(prev => ({...prev, inicio: e.target.value}))}
            className="input-search"
            style={{ width: '150px', background: 'rgba(0,0,0,0.2)' }}
          />
          <span style={{ color: 'var(--text-muted)' }}>al</span>
          <input 
            type="date" 
            value={range.fin} 
            onChange={e => setRange(prev => ({...prev, fin: e.target.value}))}
            className="input-search"
            style={{ width: '150px', background: 'rgba(0,0,0,0.2)' }}
          />
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
          <button onClick={fetchStats} className="btn btn-primary" style={{ padding: '8px 16px' }}>🔄</button>
        </div>
      </div>

      {/* Tarjetas de Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="card" style={{ textAlign: 'center', borderBottom: '4px solid var(--accent-success)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🟢</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'white' }}>{data?.online_ahora || 0}</div>
          <div style={{ fontSize: '12px', color: 'var(--accent-success)', fontWeight: 700, textTransform: 'uppercase' }}>En Línea Ahora</div>
        </div>
        <div className="card" style={{ textAlign: 'center', borderBottom: '4px solid var(--accent-primary)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>👥</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'white' }}>
            {data?.registros?.reduce((acc, curr) => acc + curr.cantidad, 0) || 0}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: 700, textTransform: 'uppercase' }}>Nuevos Registros</div>
        </div>
        <div className="card" style={{ textAlign: 'center', borderBottom: '4px solid #a855f7' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📦</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'white' }}>
            {data?.pedidos?.reduce((acc, curr) => acc + curr.cantidad, 0) || 0}
          </div>
          <div style={{ fontSize: '12px', color: '#a855f7', fontWeight: 700, textTransform: 'uppercase' }}>Pedidos Exitosos</div>
        </div>
        <div className="card" style={{ textAlign: 'center', borderBottom: '4px solid #ffc107' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏱️</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'white' }}>
            {data?.tiempo_promedio?.length > 0 
              ? (data.tiempo_promedio.reduce((acc, curr) => acc + curr.minutos_promedio, 0) / data.tiempo_promedio.length).toFixed(1)
              : 0}m
          </div>
          <div style={{ fontSize: '12px', color: '#ffc107', fontWeight: 700, textTransform: 'uppercase' }}>Tiempo Promedio</div>
        </div>
      </div>

      {/* Gráficas Principales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
        
        {/* Registros vs Actividad */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ color: 'white', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>📈</span> Crecimiento y Actividad
          </h3>
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer>
              <AreaChart data={data?.registros}>
                <defs>
                  <linearGradient id="colorReg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="fecha" tickFormatter={formatFecha} stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 22, 0.95)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  labelFormatter={formatFecha}
                />
                <Legend />
                <Area type="monotone" dataKey="cantidad" name="Registros" stroke="var(--accent-primary)" fillOpacity={1} fill="url(#colorReg)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pedidos Procesados */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ color: 'white', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>✅</span> Pedidos Exitosos
          </h3>
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer>
              <BarChart data={data?.pedidos}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="fecha" tickFormatter={formatFecha} stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 22, 0.95)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  labelFormatter={formatFecha}
                />
                <Bar dataKey="cantidad" name="Pedidos" fill="#a855f7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tiempo de Estancia */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ color: 'white', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🕒</span> Tiempo de Estancia Promedio
          </h3>
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer>
              <LineChart data={data?.tiempo_promedio}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="fecha" tickFormatter={formatFecha} stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} unit="m" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 22, 0.95)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  labelFormatter={formatFecha}
                />
                <Line type="monotone" dataKey="minutos_promedio" name="Minutos" stroke="#ffc107" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Actividad de Usuarios (Inicios de sesión) */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ color: 'white', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🔑</span> Actividad (Logins)
          </h3>
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer>
              <AreaChart data={data?.logins}>
                <defs>
                  <linearGradient id="colorLogin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="fecha" tickFormatter={formatFecha} stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 22, 0.95)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  labelFormatter={formatFecha}
                />
                <Area type="monotone" dataKey="cantidad" name="Logins" stroke="#22c55e" fillOpacity={1} fill="url(#colorLogin)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
