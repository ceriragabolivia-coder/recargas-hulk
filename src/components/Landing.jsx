import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useConfiguracion, useAuth } from '../hooks/useData'
import { formatUSD, formatBs, calcularPrecioVenta } from '../utils/helpers'

export default function Landing() {
  const navigate = useNavigate()
  const { config } = useConfiguracion()
  const { user } = useAuth()
  const isRevendedor = user?.role === 'revendedor'
  
  const [juegos, setJuegos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('Todos')
  const [search, setSearch] = useState('')
  const [currentBanner, setCurrentBanner] = useState(0)
  
  // Modo Nocturno
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('landing_dark_mode') === 'true')

  // Detalle de Juego
  const [selectedJuego, setSelectedJuego] = useState(null)
  const [productosJuego, setProductosJuego] = useState([])
  const [loadingProductos, setLoadingProductos] = useState(false)

  const banners = useMemo(() => [
    {
      image: config?.landing_banner_1 || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=2070',
      title: config?.landing_banner_1_title || config?.landing_subtitulo || '¡Recargas al Instante!',
      text: config?.landing_banner_1_text || 'Seguridad y confianza en cada transacción',
      btnText: config?.landing_banner_1_btn_text || 'Empieza ahora',
      url: config?.landing_banner_1_url || '/register'
    },
    {
      image: config?.landing_banner_2 || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=2071',
      title: config?.landing_banner_2_title || 'Los mejores precios del mercado',
      text: config?.landing_banner_2_text || 'Seguridad y confianza en cada transacción',
      btnText: config?.landing_banner_2_btn_text || 'Empieza ahora',
      url: config?.landing_banner_2_url || '/register'
    },
    {
      image: config?.landing_banner_3 || 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80&w=2070',
      title: config?.landing_banner_3_title || 'Explora nuestro catálogo',
      text: config?.landing_banner_3_text || 'Seguridad y confianza en cada transacción',
      btnText: config?.landing_banner_3_btn_text || 'Empieza ahora',
      url: config?.landing_banner_3_url || '/register'
    }
  ], [config])

  useEffect(() => {
    localStorage.setItem('landing_dark_mode', darkMode)
  }, [darkMode])

  useEffect(() => {
    async function fetchData() {
      const [jRes, cRes] = await Promise.all([
        supabase.from('juegos')
          .select('*, categorias(nombre)')
          .eq('activo', true)
          .is('owner_id', null)
          .eq('mostrar_en_landing', true)
          .order('orden_landing', { ascending: true })
          .order('nombre'),
        supabase.from('categorias')
          .select('*')
          .eq('activa', true)
          .is('owner_id', null)
          .order('orden')
      ])
      
      if (jRes.data) setJuegos(jRes.data)
      if (cRes.data) setCategorias(cRes.data)
      setLoading(false)
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedJuego) {
      const fetchProductos = async () => {
        setLoadingProductos(true)
        const { data } = await supabase
          .from('productos')
          .select('*')
          .eq('juego_id', selectedJuego.id)
          .eq('activo', true)
          .order('orden')
        if (data) setProductosJuego(data)
        setLoadingProductos(false)
      }
      fetchProductos()
    }
  }, [selectedJuego])

  useEffect(() => {
    if (!selectedJuego) {
      const timer = setInterval(() => {
        setCurrentBanner(prev => (prev + 1) % banners.length)
      }, 5000)
      return () => clearInterval(timer)
    }
  }, [banners.length, selectedJuego])

  const filteredJuegos = useMemo(() => {
    return juegos.filter(j => {
      const matchesCategory = activeCategory === 'Todos' || j.categorias?.nombre === activeCategory
      const matchesSearch = j.nombre.toLowerCase().includes(search.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [juegos, activeCategory, search])

  const bestsellers = useMemo(() => {
    if (config?.landing_featured_games) {
      const ids = config.landing_featured_games.split(',').map(id => id.trim())
      return juegos.filter(j => ids.includes(String(j.id)))
    }
    return juegos.slice(0, 12)
  }, [juegos, config])

  if (loading || !config) {
    return (
      <div className="landing-loading">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className={`landing-page ${darkMode ? 'dark' : ''}`}>
      {/* HEADER */}
      <header className="landing-header">
        <div className="landing-container flex items-center justify-between" style={{ gap: '40px' }}>
          <div className="flex items-center" style={{ gap: '40px' }}>
            <div className="landing-logo-container" onClick={() => { setSelectedJuego(null); navigate('/'); }}>
              {config?.landing_logo ? (
                <img src={config.landing_logo} alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'contain' }} />
              ) : (
                <div className="landing-logo-icon">⚡</div>
              )}
              <span className="landing-logo-text">{config?.landing_titulo || 'Ceriraga'}</span>
            </div>
            
            <nav className="landing-nav hidden-mobile">
              <a href="#" className="nav-link active" onClick={() => setSelectedJuego(null)}>Home</a>
              <div className="nav-dropdown">
                <span className="nav-link">Servicios ▾</span>
                <div className="dropdown-content">
                  {categorias.map(cat => (
                    <a key={cat.id} href="#" onClick={() => { setActiveCategory(cat.nombre); setSelectedJuego(null); }}>{cat.nombre}</a>
                  ))}
                </div>
              </div>
              <a href="#" className="nav-link">Cupones</a>
              <a href="#" className="nav-link">Ayuda</a>
            </nav>
          </div>

          <div className="flex items-center" style={{ gap: '24px' }}>
            {!selectedJuego && (
              <div className="landing-search hidden-mobile">
                <input 
                  type="text" 
                  placeholder="Buscar juegos o servicios..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <span className="search-icon">🔍</span>
              </div>
            )}
            
            {/* BOTON MODO NOCTURNO */}
            <button 
              className="btn-theme-toggle" 
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? 'Modo Claro' : 'Modo Nocturno'}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>

            <button className="btn-landing-secondary" onClick={() => navigate('/login')}>Entrar</button>
            <button className="btn-landing-primary" onClick={() => navigate('/register')}>Registrarse</button>
          </div>
        </div>
      </header>

      <main className="landing-main">
        {selectedJuego ? (
          /* VISTA DETALLE DEL JUEGO */
          <div className="landing-container detail-view fade-in">
            <div className="breadcrumb">
              <span onClick={() => setSelectedJuego(null)}>Home</span> &gt; <span>{selectedJuego.nombre}</span>
            </div>

            <div className="detail-layout">
              <div className="detail-main">
                {/* Info superior */}
                <div className="detail-header-card">
                  <img src={selectedJuego.icono_url} alt="" className="detail-header-icon" />
                  <div className="detail-header-info">
                    <h1>{selectedJuego.nombre}</h1>
                    <div className="detail-stats">
                      <span className="rating">⭐ 5.0 (200+ Reviews)</span>
                      <span className="sold">🔥 200K+ Sold</span>
                      <span className="badge-secure">✅ Secure</span>
                    </div>
                  </div>
                </div>

                {/* Lista de Precios */}
                <div className="price-list-section">
                  <h3>Selecciona un paquete</h3>
                  {loadingProductos ? (
                    <div className="spinner"></div>
                  ) : (
                    <div className="products-grid">
                      {productosJuego.map(prod => {
                        const pricing = calcularPrecioVenta(prod, selectedJuego, config)
                        return (
                          <div key={prod.id} className="product-card" onClick={() => navigate('/login')}>
                            {prod.icono_url && <img src={prod.icono_url} alt="" className="product-icon" />}
                            <div className="product-name">{prod.nombre}</div>
                            <div className="product-price">
                              {isRevendedor ? (
                                <span className="price-primary">{formatUSD(pricing.venta_usd)}</span>
                              ) : (
                                <span className="price-primary">{formatBs(pricing.venta_bs)}</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Información / Guías */}
                <div className="info-content-section">
                  <div className="info-tab-header">
                    <h4>Información de {selectedJuego.nombre}</h4>
                  </div>
                  <div className="info-body">
                    {selectedJuego.caracteristicas_nota ? (
                      <div className="rich-text" dangerouslySetInnerHTML={{ __html: selectedJuego.caracteristicas_nota.replace(/\n/g, '<br/>') }} />
                    ) : (
                      <p>Para adquirir recargas de {selectedJuego.nombre}, solo necesitas proporcionar tu ID de jugador. La entrega es inmediata una vez verificado el pago.</p>
                    )}
                    
                    <h5>¿Cómo recargar?</h5>
                    <ul>
                      <li>Selecciona el paquete que deseas adquirir.</li>
                      <li>Inicia sesión o regístrate en nuestra plataforma.</li>
                      <li>Completa el pago mediante tu método favorito (Pago Móvil, Binance, PayPal).</li>
                      <li>¡Listo! Tu recarga llegará en minutos.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* SIDEBAR DE COMPRA */}
              <aside className="detail-sidebar">
                <div className="purchase-card">
                  <h3>¿Listo para recargar?</h3>
                  <p>Inicia sesión o crea una cuenta para poder realizar compras y gestionar tus pedidos.</p>
                  
                  <div className="sidebar-buttons">
                    <button className="btn-landing-primary w-full mb-12" onClick={() => navigate('/login')}>
                      🔐 Iniciar Sesión
                    </button>
                    <button className="btn-landing-secondary w-full" onClick={() => navigate('/register')}>
                      📝 Registrarse
                    </button>
                  </div>

                  <div className="sidebar-features">
                    <div className="feature-item">
                      <span>⚡</span>
                      <div>
                        <strong>Entrega Rápida</strong>
                        <small>Promedio de 5-10 minutos</small>
                      </div>
                    </div>
                    <div className="feature-item">
                      <span>🛡️</span>
                      <div>
                        <strong>Compra Segura</strong>
                        <small>Tus datos están protegidos</small>
                      </div>
                    </div>
                    <div className="feature-item">
                      <span>💰</span>
                      <div>
                        <strong>Mejor Tasa</strong>
                        <small>Precios competitivos</small>
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        ) : (
          /* VISTA CATALOGO PRINCIPAL */
          <>
            {/* HERO SLIDER */}
            {!search.trim() && (
              <section className="landing-hero landing-container">
              <div className="hero-slider">
                {banners.map((banner, idx) => (
                  <div 
                    key={idx} 
                    className={`hero-slide ${idx === currentBanner ? 'active' : ''}`}
                    style={{ backgroundImage: `url(${banner.image})` }}
                  >
                    <div className="hero-content">
                      <h2>{banner.title}</h2>
                      <p>{banner.text}</p>
                      <button 
                        className="btn-landing-primary" 
                        onClick={() => {
                          if (banner.url.startsWith('http')) {
                            window.location.href = banner.url
                          } else {
                            navigate(banner.url)
                          }
                        }}
                      >
                        {banner.btnText}
                      </button>
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
            )}

            {/* BESTSELLERS */}
            {!search.trim() && (
              <section className="landing-section landing-container">
                <div className="section-header">
                  <h3>Bestsellers</h3>
                  <a href="#all-games" className="view-all">Ver todos &gt;</a>
                </div>
                <div className="games-grid">
                  {bestsellers.map(juego => (
                    <GameCard key={juego.id} juego={juego} onSelect={() => setSelectedJuego(juego)} />
                  ))}
                </div>
              </section>
            )}

            {/* ALL GAMES / CATEGORIES */}
            <section id="all-games" className="landing-section landing-container" style={{ marginTop: search.trim() ? '20px' : undefined }}>
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
                  <GameCard key={juego.id} juego={juego} onSelect={() => setSelectedJuego(juego)} />
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="landing-footer">
        <div className="landing-container footer-content">
          <div className="footer-brand">
            <div className="landing-logo-container" onClick={() => setSelectedJuego(null)}>
              {config?.landing_logo ? (
                <img src={config.landing_logo} alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'contain' }} />
              ) : (
                <div className="landing-logo-icon">⚡</div>
              )}
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
        :root {
          --bg-page: #f8f9fa;
          --bg-card: #ffffff;
          --bg-header: #ffffff;
          --text-main: #1a1d21;
          --text-muted: #4a5568;
          --border: #e2e8f0;
          --bg-hover: #f7fafc;
          --accent: #7b2ff7;
          --accent-light: rgba(123, 47, 247, 0.1);
        }

        .dark {
          --bg-page: #0f172a;
          --bg-card: #1e293b;
          --bg-header: #1e293b;
          --text-main: #f8fafc;
          --text-muted: #94a3b8;
          --border: #334155;
          --bg-hover: #334155;
        }

        .landing-page {
          background-color: var(--bg-page);
          color: var(--text-main);
          font-family: 'Inter', sans-serif;
          min-height: 100vh;
          overflow-x: hidden;
          transition: background-color 0.3s, color 0.3s;
        }
        .landing-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
        }
        .landing-header {
          background: var(--bg-header);
          height: 80px;
          display: flex;
          align-items: center;
          position: sticky;
          top: 0;
          z-index: 1000;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
          border-bottom: 1px solid var(--border);
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
          background: linear-gradient(135deg, #00d2ff, var(--accent));
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
          background: linear-gradient(135deg, #00d2ff, var(--accent));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          white-space: nowrap;
        }
        .landing-nav {
          display: flex;
          gap: 24px;
        }
        .nav-link {
          color: var(--text-muted);
          text-decoration: none;
          font-weight: 500;
          font-size: 15px;
          transition: color 0.2s;
        }
        .nav-link:hover, .nav-link.active {
          color: var(--accent);
        }
        .nav-dropdown {
          position: relative;
        }
        .dropdown-content {
          display: none;
          position: absolute;
          top: 100%;
          left: 0;
          background: var(--bg-card);
          min-width: 200px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          border-radius: 8px;
          padding: 8px 0;
          z-index: 100;
          border: 1px solid var(--border);
        }
        .nav-dropdown:hover .dropdown-content {
          display: block;
        }
        .dropdown-content a {
          display: block;
          padding: 10px 20px;
          color: var(--text-muted);
          text-decoration: none;
          font-size: 14px;
        }
        .dropdown-content a:hover {
          background: var(--bg-hover);
          color: var(--accent);
        }
        .landing-search {
          position: relative;
          width: 300px;
        }
        .landing-search input {
          width: 100%;
          padding: 10px 16px 10px 40px;
          border-radius: 20px;
          border: 1px solid var(--border);
          background: var(--bg-hover);
          color: var(--text-main);
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        .landing-search input:focus {
          border-color: var(--accent);
        }
        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }
        
        .btn-theme-toggle {
          background: var(--bg-hover);
          border: 1px solid var(--border);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 18px;
          transition: transform 0.2s;
        }
        .btn-theme-toggle:hover {
          transform: scale(1.1);
        }

        .btn-landing-primary {
          background: var(--accent);
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
          color: var(--text-muted);
          border: 1px solid var(--border);
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-landing-secondary:hover {
          background: var(--bg-hover);
        }
        
        .landing-main {
          padding: 20px 0;
          min-height: 600px;
        }
        .hero-slider {
          height: 320px;
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
          margin-top: 30px;
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
          color: var(--accent);
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
          background: var(--bg-card);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 15px rgba(0,0,0,0.05);
          transition: transform 0.3s, box-shadow 0.3s;
          cursor: pointer;
          position: relative;
          border: 1px solid var(--border);
        }
        .game-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 12px 30px rgba(0,0,0,0.1);
          border-color: var(--accent);
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
          color: var(--text-muted);
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
          background: var(--bg-card);
          border: 1px solid var(--border);
          padding: 8px 20px;
          border-radius: 20px;
          white-space: nowrap;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
          color: var(--text-main);
        }
        .pill.active {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
        }

        /* DETAIL VIEW STYLES */
        .detail-view {
          margin-top: 20px;
        }
        .breadcrumb {
          font-size: 14px;
          color: var(--text-muted);
          margin-bottom: 24px;
        }
        .breadcrumb span {
          cursor: pointer;
        }
        .breadcrumb span:hover {
          color: var(--accent);
        }
        .detail-layout {
          display: grid;
          grid-template-columns: 1fr 350px;
          gap: 30px;
        }
        .detail-header-card {
          background: var(--bg-card);
          padding: 24px;
          border-radius: 20px;
          display: flex;
          gap: 24px;
          align-items: center;
          margin-bottom: 30px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.05);
          border: 1px solid var(--border);
        }
        .detail-header-icon {
          width: 100px;
          height: 100px;
          border-radius: 20px;
          object-fit: cover;
          box-shadow: 0 8px 20px rgba(0,0,0,0.1);
        }
        .detail-header-info h1 {
          font-size: 32px;
          font-weight: 800;
          margin-bottom: 10px;
        }
        .detail-stats {
          display: flex;
          gap: 16px;
          font-size: 14px;
          align-items: center;
        }
        .badge-secure {
          background: var(--accent-light);
          color: var(--accent);
          padding: 4px 12px;
          border-radius: 20px;
          font-weight: 700;
        }

        .price-list-section {
          background: var(--bg-card);
          padding: 24px;
          border-radius: 20px;
          margin-bottom: 30px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.05);
          border: 1px solid var(--border);
        }
        .price-list-section h3 {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 20px;
          padding-left: 10px;
          border-left: 4px solid var(--accent);
        }
        .products-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 20px;
        }
        .product-card {
          background: var(--bg-card);
          border: 2px solid var(--border);
          border-radius: 20px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          position: relative;
        }
        .product-card:hover {
          border-color: var(--accent);
          background: var(--accent-light);
          transform: translateY(-8px) scale(1.02);
          box-shadow: 0 15px 35px rgba(123,47,247,0.2);
        }
        .product-icon {
          width: 64px;
          height: 64px;
          margin-bottom: 16px;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));
          transition: transform 0.3s;
        }
        .product-card:hover .product-icon {
          transform: scale(1.1) rotate(5deg);
        }
        .product-name {
          font-weight: 700;
          font-size: 16px;
          margin-bottom: 12px;
          height: 48px;
          display: flex;
          align-items: center;
          color: var(--text-main);
          line-height: 1.3;
        }
        .product-price {
          display: flex;
          flex-direction: column;
          gap: 4px;
          width: 100%;
          padding-top: 12px;
          border-top: 1px solid var(--border);
        }
        .price-primary {
          font-weight: 900;
          font-size: 22px;
          color: var(--accent);
          letter-spacing: -0.5px;
        }
        .price-secondary {
          font-size: 13px;
          color: var(--text-muted);
          font-weight: 600;
          opacity: 0.8;
        }

        .info-content-section {
          background: var(--bg-card);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 4px 15px rgba(0,0,0,0.05);
          margin-bottom: 60px;
          border: 1px solid var(--border);
        }
        .info-tab-header {
          background: var(--bg-hover);
          padding: 16px 24px;
          border-bottom: 1px solid var(--border);
        }
        .info-tab-header h4 {
          margin: 0;
          font-weight: 700;
        }
        .info-body {
          padding: 24px;
          line-height: 1.8;
          color: var(--text-main);
        }
        .info-body h5 {
          font-size: 18px;
          font-weight: 700;
          margin-top: 30px;
          margin-bottom: 16px;
        }
        .info-body ul {
          padding-left: 20px;
        }

        .detail-sidebar {
          position: sticky;
          top: 100px;
          height: fit-content;
        }
        .purchase-card {
          background: var(--bg-card);
          padding: 24px;
          border-radius: 24px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          border: 1px solid var(--border);
        }
        .purchase-card h3 {
          font-size: 22px;
          font-weight: 800;
          margin-bottom: 12px;
        }
        .purchase-card p {
          font-size: 14px;
          color: var(--text-muted);
          margin-bottom: 24px;
          line-height: 1.5;
        }
        .w-full { width: 100%; }
        .mb-12 { margin-bottom: 12px; }
        .sidebar-features {
          margin-top: 30px;
          padding-top: 30px;
          border-top: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .feature-item {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .feature-item span {
          width: 36px;
          height: 36px;
          background: var(--bg-hover);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }
        .feature-item strong {
          display: block;
          font-size: 14px;
          color: var(--text-main);
        }
        .feature-item small {
          font-size: 12px;
          color: var(--text-muted);
        }

        .landing-footer {
          margin-top: 60px;
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
          background: var(--bg-page);
        }

        .fade-in {
          animation: fadeIn 0.4s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 1024px) {
          .detail-layout { grid-template-columns: 1fr; }
          .detail-sidebar { position: static; }
        }

        @media (max-width: 768px) {
          .hidden-mobile { display: none; }
          .hero-slider { height: 300px; }
          .hero-content h2 { font-size: 32px; }
          .footer-content { grid-template-columns: 1fr; gap: 40px; }
          .hero-slide { padding: 0 30px; }
          .detail-header-card { flex-direction: column; text-align: center; }
          .products-grid { grid-template-columns: 1fr 1fr; }
        }
      `}} />
    </div>
  )
}

function GameCard({ juego, onSelect }) {
  // Generar un número de ventas estable basado en el ID para que no cambie al re-renderizar
  const sold = useMemo(() => {
    const seed = (juego.id || 0).toString().split('').reduce((a, b) => a + b.charCodeAt(0), 0)
    return (10 + (seed % 190)).toFixed(1) + 'K'
  }, [juego.id])

  return (
    <div className="game-card" onClick={onSelect}>
      {juego.etiqueta_descuento && <div className="badge-discount">{juego.etiqueta_descuento}</div>}
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
