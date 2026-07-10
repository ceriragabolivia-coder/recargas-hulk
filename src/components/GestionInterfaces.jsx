import React, { useState } from 'react';
import { useConfiguracion } from '../hooks/useData';
import AlertModal from './AlertModal';

const INTERFACES = [
  {
    id: 'default',
    name: 'Interfaz Actual',
    description: 'El diseño oscuro y neón clásico de Hulk.',
    preview: '🎨'
  },
  {
    id: 'lootadmin',
    name: 'LootAdmin Pro',
    description: 'Diseño premium oscuro con estilo minimalista.',
    preview: '🎮'
  }
];

export default function GestionInterfaces() {
  const { config, updateConfig, loading: configLoading } = useConfiguracion();
  const [alertModal, setAlertModal] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Valor por defecto en caso de no existir
  const activeInterface = localStorage.getItem('local_admin_interface') || config?.admin_interface || 'default';

  const handleSelectInterface = async (ifaceId) => {
    if (ifaceId === activeInterface) return;

    setAlertModal({
      type: 'confirm',
      title: 'Cambiar Interfaz',
      message: `¿Estás seguro de que quieres cambiar la interfaz activa a "${INTERFACES.find(i => i.id === ifaceId)?.name}"?`,
      onConfirm: async () => {
        setAlertModal(null);
        setIsUpdating(true);
        // Bypass DB update completely for now to avoid RLS issues
        // const { error } = await updateConfig('admin_interface', ifaceId, true);
        setIsUpdating(false);
        
        localStorage.setItem('local_admin_interface', ifaceId);
        window.location.reload();
      }
    });
  };

  if (configLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'white' }}>
        <p>Cargando configuración de interfaces...</p>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px', 
      color: 'white',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      <div style={{
        backgroundColor: 'rgba(25, 25, 35, 0.8)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '30px',
        border: '1px solid rgba(0, 210, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
          <span style={{ fontSize: '32px' }}>🎨</span>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800 }}>Interfaces del Panel Admin</h1>
        </div>
        
        <p style={{ color: '#aaa', fontSize: '15px', marginBottom: '30px', lineHeight: '1.6' }}>
          Selecciona el diseño visual del panel de administración. Ten en cuenta que esto <strong>solo cambia la apariencia estética</strong> (colores, distribución, menús) y no altera ni los precios, ni la lógica, ni los productos de tu sistema.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '20px'
        }}>
          {INTERFACES.map(iface => {
            const isActive = iface.id === activeInterface;
            return (
              <div 
                key={iface.id}
                style={{
                  backgroundColor: isActive ? 'rgba(0, 210, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                  border: `2px solid ${isActive ? '#00d2ff' : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: '12px',
                  padding: '20px',
                  transition: 'all 0.3s ease',
                  cursor: isActive ? 'default' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '15px',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onClick={() => !isUpdating && handleSelectInterface(iface.id)}
              >
                {/* Indicador de activo */}
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    backgroundColor: '#00d2ff',
                    color: '#000',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    boxShadow: '0 0 10px rgba(0, 210, 255, 0.5)'
                  }}>
                    Activo
                  </div>
                )}

                <div style={{
                  fontSize: '48px',
                  textAlign: 'center',
                  padding: '30px 0',
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  borderRadius: '8px',
                  marginBottom: '10px'
                }}>
                  {iface.preview}
                </div>
                
                <div>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', color: isActive ? '#00d2ff' : 'white' }}>
                    {iface.name}
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#888', lineHeight: '1.4' }}>
                    {iface.description}
                  </p>
                </div>

                {!isActive && (
                  <button 
                    disabled={isUpdating}
                    style={{
                      marginTop: 'auto',
                      padding: '10px',
                      backgroundColor: 'transparent',
                      color: '#00d2ff',
                      border: '1px solid #00d2ff',
                      borderRadius: '8px',
                      cursor: isUpdating ? 'not-allowed' : 'pointer',
                      fontWeight: 'bold',
                      transition: 'all 0.2s',
                      opacity: isUpdating ? 0.5 : 1
                    }}
                    onMouseOver={(e) => {
                      if(!isUpdating) {
                        e.target.style.backgroundColor = '#00d2ff';
                        e.target.style.color = '#000';
                      }
                    }}
                    onMouseOut={(e) => {
                      if(!isUpdating) {
                        e.target.style.backgroundColor = 'transparent';
                        e.target.style.color = '#00d2ff';
                      }
                    }}
                  >
                    {isUpdating ? 'Aplicando...' : 'Aplicar Interfaz'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {alertModal && (
        <AlertModal
          type={alertModal.type}
          title={alertModal.title}
          message={alertModal.message}
          onConfirm={alertModal.onConfirm}
          onCancel={() => setAlertModal(null)}
        />
      )}
    </div>
  );
}
