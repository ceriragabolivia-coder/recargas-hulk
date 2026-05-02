import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useConfiguracion } from '../hooks/useData'
import { formatUSD } from '../utils/helpers'

export default function Landing() {
  const navigate = useNavigate()
  const { config } = useConfiguracion()
  const [juegos, setJuegos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('Todos')
  const [search, setSearch] = useState('')
  const [currentBanner, setCurrentBanner] = useState(0)

  const banners = useMemo(() => [
    config?.landing_banner_1 || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=2070',
    config?.landing_banner_2 || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=2071',
    config?.landing_banner_3 || 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80&w=2070'
  ], [config])

  useEffect(() => {
    async function fetchData() {
      const [jRes, cRes] = await Promise.all([
        supabase.from('juegos').select('*, categorias(nombre)').eq('activo', true).order('nombre'),
        supabase.from('categorias').select('*').eq('activa', true).order('orden')
      ])
      
      if (jRes.data) setJuegos(jRes.data)
      if (cRes.data) setCategorias(cRes.data)
      setLoading(false)
    }
    fetchData()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner(prev => (prev + 1) % banners.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [banners.length])

  const filteredJuegos = useMemo(() => {
    return juegos.filter(j => {
      const matchesCategory = activeCategory === 'Todos' || j.categorias?.nombre === activeCategory
      const matchesSearch = j.nombre.toLowerCase().includes(search.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [juegos, activeCategory, search])

  const bestsellers = useMemo(() => {
    // Si hay IDs en config, usarlos. Si no, tomar los primeros 12.
    if (config?.landing_featured_games) {
      const ids = config.landing_featured_games.split(',').map(id => id.trim())
      return juegos.filter(j => ids.includes(String(j.id)))
    }
    return juegos.slice(0, 12)
  }, [juegos, config])

  if (loading) {
    return (
      <div className="landing-loading">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="landing-page">
      {/* HEADER */}
      <header className="landing-header">
        <div className="landing-container flex items-center justify-between">
          <div className="flex items-center gap-40">
            <div className="landing-logo-container" onClick={() => navigate('/')}>
              <div className="landing-logo-icon">⚡</div>
              <span className="landing-logo-text">{config?.landing_titulo || 'Ceriraga'}</span>
            </div>
            
            <nav className="landing-nav hidden-mobile">
              <a href="#" className="nav-link active">Home</a>
              <div className="nav-dropdown">
                <span className="nav-link">Servicios ▾</span>
                <div className="dropdown-content">
                  {categorias.map(cat => (
                    <a key={cat.id} href="#" onClick={() => setActiveCategory(cat.nombre)}>{cat.nombre}</a>
                  ))}
                </div>
              </div>
              <a href="#" className="nav-link">Cupones</a>
              <a href="#" className="nav-link">Ayuda</a>
            </nav>
          </div>

          <div className="flex items-center gap-16">
            <div className="landing-search hidden-mobile">
              <input 
                type="text" 
                placeholder="Buscar juegos o servicios..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="search-icon">🔍</span>
            </div>
            <button className="btn-landing-secondary" onClick={() => navigate('/login')}>Entrar</button>
            <button className="btn-landing-primary" onClick={() => navigate('/register')}>Registrarse</button>
          </div>
        </div>
      </header>

      <main className="landing-main">
        {/* HERO SLIDER */}
        <section className="landing-hero landing-container">
          <div className="hero-slider">
            {banners.map((url, idx) => (
              <div 
                key={idx} 
                className={`hero-slide ${idx === currentBanner ? 'active' : ''}`}
                style={{ backgroundImage: `url(${url})` }}
              >
                <div className="hero-content">
                  <h2>{idx === 0 ? (config?.landing_subtitulo || '¡Recargas al Instante!') : 'Los mejores precios del mercado'}</h2>
                  <p>Seguridad y confianza en cada transacción</p>
                  <button className="btn-landing-primary" onClick={() => navigate('/register')}>Empieza ahora</button>
                </div>
              </div>
            ))}
            <div className="slider-dots">
              {banners.map((_, idx) => (
                <span 
                  key={idx} 
                  className={`dot ${idx === currentBanner ? 'active' : ''}`}
                  onClick={() => setCurrentBanner(idx)}
                ></span>
              ))}
            </div>
          </div>
        </section>

        {/* BESTSELLERS */}
        <section className="landing-section landing-container">
          <div className="section-header">
            <h3>Bestsellers</h3>
            <a href="#all-games" className="view-all">Ver todos &gt;</a>
          </div>
          <div className="games-grid">
            {bestsellers.map(juego => (
              <GameCard key={juego.id} juego={juego} onSelect={() => navigate('/login')} />
            ))}
          </div>
        </section>

        {/* ALL GAMES / CATEGORIES */}
        <section id="all-games" className="landing-section landing-container">
          <div className="section-header">
            <h3>Explorar Catálogo</h3>
          </div>
          <div className="category-pills">
            <button 
              className={`pill ${activeCategory === 'Todos' ? 'active' : ''}`}
              onClick={() => setActiveCategory('Todos')}
            >
              Todos
            </button>
            {categorias.map(cat => (
              <button 
                key={cat.id} 
                className={`pill ${activeCategory === cat.nombre ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.nombre)}
              >
                {cat.nombre}
              </button>
            ))}
          </div>
          <div className="games-grid">
            {filteredJuegos.map(juego => (
              <GameCard key={juego.id} juego={juego} onSelect={() => navigate('/login')} />
            ))}
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container footer-content">
          <div className="footer-brand">
            <div className="landing-logo-container">
              <div className="landing-logo-icon">⚡</div>
              <span className="landing-logo-text">{config?.landing_titulo || 'Ceriraga'}</span>
            </div>
            <p>Tu plataforma líder en recargas y servicios digitales en Venezuela. Seguridad, rapidez y los mejores precios.</p>
          </div>
          <div className="footer-links">
            <h4>Empresa</h4>
            <a href="#">Nosotros</a>
            <a href="#">Términos y Condiciones</a>
            <a href="#">Privacidad</a>
          </div>
          <div className="footer-links">
            <h4>Soporte</h4>
            <a href="#">Preguntas Frecuentes</a>
            <a href="#">Contacto WhatsApp</a>
            <a href="#">Estado del Sistema</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2024 Ceriraga. Todos los derechos reservados.</p>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        .landing-page {
          background-color: #f8f9fa;
          color: #1a1d21;
          font-family: 'Inter', sans-serif;
          min-height: 100vh;
          overflow-x: hidden;
        }
        .landing-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
        }
        .landing-header {
          background: white;
          height: 80px;
          display: flex;
          align-items: center;
          position: sticky;
          top: 0;
          z-index: 1000;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        .landing-logo-container {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }
        .landing-logo-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #00d2ff, #7b2ff7);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 24px;
          font-weight: bold;
        }
        .landing-logo-text {
          font-size: 22px;
          font-weight: 800;
          background: linear-gradient(135deg, #00d2ff, #7b2ff7);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .landing-nav {
          display: flex;
          gap: 24px;
        }
        .nav-link {
          color: #4a5568;
          text-decoration: none;
          font-weight: 500;
          font-size: 15px;
          transition: color 0.2s;
        }
        .nav-link:hover, .nav-link.active {
          color: #7b2ff7;
        }
        .nav-dropdown {
          position: relative;
        }
        .dropdown-content {
          display: none;
          position: absolute;
          top: 100%;
          left: 0;
          background: white;
          min-width: 200px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          border-radius: 8px;
          padding: 8px 0;
          z-index: 100;
        }
        .nav-dropdown:hover .dropdown-content {
          display: block;
        }
        .dropdown-content a {
          display: block;
          padding: 10px 20px;
          color: #4a5568;
          text-decoration: none;
          font-size: 14px;
        }
        .dropdown-content a:hover {
          background: #f7fafc;
          color: #7b2ff7;
        }
        .landing-search {
          position: relative;
          width: 300px;
        }
        .landing-search input {
          width: 100%;
          padding: 10px 16px 10px 40px;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          background: #f7fafc;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        .landing-search input:focus {
          border-color: #7b2ff7;
        }
        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #a0aec0;
        }
        .btn-landing-primary {
          background: #7b2ff7;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s, background 0.2s;
        }
        .btn-landing-primary:hover {
          background: #6b21e8;
          transform: translateY(-1px);
        }
        .btn-landing-secondary {
          background: transparent;
          color: #4a5568;
          border: 1px solid #e2e8f0;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-landing-secondary:hover {
          background: #f7fafc;
        }
        
        .landing-main {
          padding: 40px 0;
        }
        .hero-slider {
          height: 450px;
          border-radius: 24px;
          overflow: hidden;
          position: relative;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        .hero-slide {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          background-size: cover;
          background-position: center;
          opacity: 0;
          transition: opacity 0.8s ease;
          display: flex;
          align-items: center;
          padding: 0 60px;
        }
        .hero-slide.active {
          opacity: 1;
        }
        .hero-slide::after {
          content: '';
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          background: linear-gradient(90deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 60%);
          z-index: 1;
        }
        .hero-content {
          position: relative;
          z-index: 2;
          color: white;
          max-width: 500px;
        }
        .hero-content h2 {
          font-size: 48px;
          font-weight: 800;
          margin-bottom: 16px;
          line-height: 1.2;
        }
        .hero-content p {
          font-size: 18px;
          margin-bottom: 32px;
          opacity: 0.9;
        }
        .slider-dots {
          position: absolute;
          bottom: 30px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 8px;
          z-index: 10;
        }
        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: rgba(255,255,255,0.3);
          cursor: pointer;
        }
        .dot.active {
          background: white;
          width: 30px;
          border-radius: 5px;
        }

        .landing-section {
          margin-top: 60px;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }
        .section-header h3 {
          font-size: 28px;
          font-weight: 700;
        }
        .view-all {
          color: #7b2ff7;
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
        }
        .games-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 20px;
        }
        .game-card {
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 15px rgba(0,0,0,0.05);
          transition: transform 0.3s, box-shadow 0.3s;
          cursor: pointer;
          position: relative;
        }
        .game-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 12px 30px rgba(0,0,0,0.1);
        }
        .game-image {
          width: 100%;
          aspect-ratio: 1/1;
          object-fit: cover;
        }
        .game-info {
          padding: 12px;
        }
        .game-name {
          font-weight: 600;
          font-size: 15px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 4px;
        }
        .game-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #718096;
        }
        .rating {
          color: #f59e0b;
          font-weight: 700;
        }
        .badge-discount {
          position: absolute;
          top: 10px;
          right: 10px;
          background: #ff6b6b;
          color: white;
          font-size: 11px;
          font-weight: 800;
          padding: 4px 8px;
          border-radius: 6px;
          z-index: 5;
        }

        .category-pills {
          display: flex;
          gap: 12px;
          margin-bottom: 30px;
          overflow-x: auto;
          padding-bottom: 10px;
        }
        .pill {
          background: white;
          border: 1px solid #e2e8f0;
          padding: 8px 20px;
          border-radius: 20px;
          white-space: nowrap;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }
        .pill.active {
          background: #7b2ff7;
          color: white;
          border-color: #7b2ff7;
        }

        .landing-footer {
          margin-top: 100px;
          background: #1a1d21;
          color: #a0aec0;
          padding: 80px 0 40px;
        }
        .footer-content {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 60px;
        }
        .footer-brand {
          max-width: 400px;
        }
        .footer-brand p {
          margin-top: 20px;
          line-height: 1.6;
        }
        .footer-links h4 {
          color: white;
          margin-bottom: 24px;
          font-size: 18px;
        }
        .footer-links a {
          display: block;
          color: #a0aec0;
          text-decoration: none;
          margin-bottom: 12px;
          transition: color 0.2s;
        }
        .footer-links a:hover {
          color: #00d2ff;
        }
        .footer-bottom {
          margin-top: 60px;
          padding-top: 30px;
          border-top: 1px solid rgba(255,255,255,0.05);
          text-align: center;
          font-size: 13px;
        }

        .landing-loading {
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
        }

        @media (max-width: 768px) {
          .hidden-mobile { display: none; }
          .hero-slider { height: 300px; }
          .hero-content h2 { font-size: 32px; }
          .footer-content { grid-template-columns: 1fr; gap: 40px; }
        }
      `}} />
    </div>
  )
}

function GameCard({ juego, onSelect }) {
  // Simular descuento si no tiene
  const discount = Math.random() > 0.5 ? Math.floor(Math.random() * 40) + 10 : null
  const sold = useMemo(() => (Math.random() * 100).toFixed(1) + 'K', [])

  return (
    <div className="game-card" onClick={onSelect}>
      {discount && <div className="badge-discount">-{discount}%</div>}
      <img 
        src={juego.icono_url || 'https://via.placeholder.com/200x250?text=' + juego.nombre} 
        alt={juego.nombre} 
        className="game-image" 
      />
      <div className="game-info">
        <div className="game-name">{juego.nombre}</div>
        <div className="game-meta">
          <span className="rating">⭐ 5.0</span>
          <span>•</span>
          <span>{sold} Sold</span>
        </div>
      </div>
    </div>
  )
}
