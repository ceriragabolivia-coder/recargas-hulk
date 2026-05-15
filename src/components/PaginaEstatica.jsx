import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import DOMPurify from 'dompurify'

export default function PaginaEstatica() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [pagina, setPagina] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPagina() {
      setLoading(true)
      const { data, error } = await supabase
        .from('paginas_estaticas')
        .select('*')
        .eq('slug', slug)
        .eq('visible', true)
        .maybeSingle()

      if (error) {
        console.error('Error fetching page:', error)
      } else if (data) {
        setPagina(data)
      }
      setLoading(false)
    }
    fetchPagina()
  }, [slug])

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  if (!pagina) {
    return (
      <div className="page-content" style={{ textAlign: 'center', padding: '100px 20px' }}>
        <h2 style={{ fontSize: '48px', color: 'var(--accent)', marginBottom: '20px' }}>404</h2>
        <h3>Página no encontrada</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>Lo sentimos, la página que buscas no existe o no está disponible.</p>
        <button className="btn-landing-primary" onClick={() => navigate('/')}>Volver al Inicio</button>
      </div>
    )
  }

  return (
    <div className="static-page-container" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="card-modern shadow-xl" style={{ padding: '40px', background: 'var(--bg-card)', borderRadius: '24px', border: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '30px', borderBottom: '2px solid var(--accent)', paddingBottom: '15px', color: 'var(--text-main)' }}>
          {pagina.titulo}
        </h1>
        <div 
          className="rich-text-content" 
          style={{ lineHeight: '1.8', fontSize: '16px', color: 'var(--text-main)' }}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(pagina.contenido) }} 
        />
        <div style={{ marginTop: '50px', paddingTop: '20px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <button className="btn-landing-secondary" onClick={() => navigate('/')}>Regresar</button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .rich-text-content h1, .rich-text-content h2, .rich-text-content h3 {
          margin-top: 30px;
          margin-bottom: 15px;
          color: var(--accent);
        }
        .rich-text-content p {
          margin-bottom: 20px;
        }
        .rich-text-content ul, .rich-text-content ol {
          margin-bottom: 20px;
          padding-left: 25px;
        }
        .rich-text-content li {
          margin-bottom: 8px;
        }
        .rich-text-content img {
          max-width: 100%;
          height: auto;
          border-radius: 12px;
          margin: 20px 0;
        }
        .rich-text-content a {
          color: var(--accent);
          text-decoration: underline;
        }
      `}} />
    </div>
  )
}
