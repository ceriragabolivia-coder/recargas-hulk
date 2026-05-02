import React, { useState } from 'react'
import { useConfiguracion } from '../hooks/useData'
import AlertModal from './AlertModal'

export default function GestionLanding() {
  const { config, updateConfig, loading } = useConfiguracion()
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)

  // Local state for form fields to avoid constant context updates during typing
  const [form, setForm] = useState({
    landing_titulo: config?.landing_titulo || '',
    landing_subtitulo: config?.landing_subtitulo || '',
    landing_banner_1: config?.landing_banner_1 || '',
    landing_banner_2: config?.landing_banner_2 || '',
    landing_banner_3: config?.landing_banner_3 || '',
    landing_featured_games: config?.landing_featured_games || '',
    landing_enabled: config?.landing_enabled === '1'
  })

  // Sincronizar cuando cargue la config real
  React.useEffect(() => {
    if (config) {
      setForm({
        landing_titulo: config.landing_titulo || '',
        landing_subtitulo: config.landing_subtitulo || '',
        landing_banner_1: config.landing_banner_1 || '',
        landing_banner_2: config.landing_banner_2 || '',
        landing_banner_3: config.landing_banner_3 || '',
        landing_featured_games: config.landing_featured_games || '',
        landing_enabled: config.landing_enabled === '1'
      })
    }
  }, [config])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await Promise.all([
        updateConfig('landing_titulo', form.landing_titulo, true),
        updateConfig('landing_subtitulo', form.landing_subtitulo, true),
        updateConfig('landing_banner_1', form.landing_banner_1, true),
        updateConfig('landing_banner_2', form.landing_banner_2, true),
        updateConfig('landing_banner_3', form.landing_banner_3, true),
        updateConfig('landing_featured_games', form.landing_featured_games, true),
        updateConfig('landing_enabled', form.landing_enabled ? '1' : '0', false)
      ])
      setAlert({ type: 'success', title: '¡Éxito!', message: 'Configuración de la Landing Page actualizada correctamente.' })
    } catch (err) {
      setAlert({ type: 'error', title: 'Error', message: 'No se pudo guardar la configuración.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="page-content">Cargando...</div>

  return (
    <div className="page-content">
      <div className="section-header-modern">
        <div className="section-title-group">
          <h2 className="section-title">Gestión de Landing Page</h2>
          <p className="section-subtitle">Personaliza la cara pública de tu plataforma</p>
        </div>
      </div>

      <div className="card-modern shadow-md" style={{ maxWidth: '800px' }}>
        <form onSubmit={handleSave} className="form-grid">
          <div className="form-group full-width">
            <label className="form-label">Estado de la Landing Page</label>
            <div className="flex items-center gap-12" style={{ marginTop: '8px' }}>
              <input 
                type="checkbox" 
                checked={form.landing_enabled}
                onChange={(e) => setForm({...form, landing_enabled: e.target.checked})}
                id="landing_enabled_check"
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              />
              <label htmlFor="landing_enabled_check" style={{ cursor: 'pointer' }}>
                Habilitar Landing Page (Si se desactiva, mostrará el Login directamente)
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Título Principal</label>
            <input 
              type="text" 
              className="form-input"
              value={form.landing_titulo}
              onChange={(e) => setForm({...form, landing_titulo: e.target.value})}
              placeholder="Ej: Ceriraga Recargas"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Subtítulo (Hero)</label>
            <input 
              type="text" 
              className="form-input"
              value={form.landing_subtitulo}
              onChange={(e) => setForm({...form, landing_subtitulo: e.target.value})}
              placeholder="Ej: Los mejores precios..."
            />
          </div>

          <div className="form-group full-width">
            <label className="form-label">URL del Banner 1 (Imagen de fondo)</label>
            <input 
              type="text" 
              className="form-input"
              value={form.landing_banner_1}
              onChange={(e) => setForm({...form, landing_banner_1: e.target.value})}
              placeholder="https://..."
            />
          </div>

          <div className="form-group full-width">
            <label className="form-label">URL del Banner 2</label>
            <input 
              type="text" 
              className="form-input"
              value={form.landing_banner_2}
              onChange={(e) => setForm({...form, landing_banner_2: e.target.value})}
              placeholder="https://..."
            />
          </div>

          <div className="form-group full-width">
            <label className="form-label">URL del Banner 3</label>
            <input 
              type="text" 
              className="form-input"
              value={form.landing_banner_3}
              onChange={(e) => setForm({...form, landing_banner_3: e.target.value})}
              placeholder="https://..."
            />
          </div>

          <div className="form-group full-width">
            <label className="form-label">IDs de Juegos Destacados (Bestsellers)</label>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Ingresa los IDs de los juegos separados por comas (ej: 1, 15, 22). Si dejas vacío, se mostrarán los primeros 12.
            </p>
            <input 
              type="text" 
              className="form-input"
              value={form.landing_featured_games}
              onChange={(e) => setForm({...form, landing_featured_games: e.target.value})}
              placeholder="1, 2, 5, 8"
            />
          </div>

          <div className="flex justify-end full-width" style={{ marginTop: '20px' }}>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ minWidth: '180px' }}
              disabled={saving}
            >
              {saving ? '⏳ Guardando...' : '💾 Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>

      {alert && (
        <AlertModal 
          type={alert.type} 
          title={alert.title} 
          message={alert.message} 
          onClose={() => setAlert(null)} 
        />
      )}
    </div>
  )
}
