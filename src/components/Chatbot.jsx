import React, { useState, useEffect } from 'react';
import { useConfiguracion } from '../hooks/useData';

const DEFAULT_FLOW = [
  {
    id: 'root',
    mensaje: 'Hola, Soy Dannielis, estoy aquí para ayudarte. Elige una opción:',
    opciones: []
  }
];

const Chatbot = () => {
  const { config, updateConfig, loading } = useConfiguracion();
  
  const [nodes, setNodes] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState(null);

  // Inicializar el flujo desde config
  useEffect(() => {
    if (!loading && config) {
      if (config.chatbot_flujo) {
        try {
          setNodes(JSON.parse(config.chatbot_flujo));
        } catch (e) {
          console.error("Error parsing chatbot flow", e);
          setNodes(DEFAULT_FLOW);
        }
      } else {
        setNodes(DEFAULT_FLOW);
      }
    }
  }, [loading, config]);

  const isChatbotActive = config?.chatbot_activo === 'true';

  const handleToggle = async () => {
    const newState = isChatbotActive ? 'false' : 'true';
    await updateConfig('chatbot_activo', newState, true);
  };

  const saveFlow = async () => {
    setIsSaving(true);
    await updateConfig('chatbot_flujo', JSON.stringify(nodes), true);
    setIsSaving(false);
  };

  const addNode = () => {
    const newNode = {
      id: `nodo_${Date.now()}`,
      mensaje: 'Nuevo mensaje del bot...',
      opciones: []
    };
    setNodes([...nodes, newNode]);
    setEditingNodeId(newNode.id);
  };

  const deleteNode = (id) => {
    if (id === 'root') return; // Cannot delete root
    // Remove node and any options pointing to it
    const updated = nodes.filter(n => n.id !== id).map(n => ({
      ...n,
      opciones: n.opciones.map(opt => 
        opt.siguiente_nodo_id === id ? { ...opt, siguiente_nodo_id: 'humano' } : opt
      )
    }));
    setNodes(updated);
  };

  const updateNode = (id, changes) => {
    setNodes(nodes.map(n => n.id === id ? { ...n, ...changes } : n));
  };

  const addOption = (nodeId) => {
    const updated = nodes.map(n => {
      if (n.id === nodeId) {
        return {
          ...n,
          opciones: [...n.opciones, { texto: 'Nueva Opción', siguiente_nodo_id: 'humano' }]
        };
      }
      return n;
    });
    setNodes(updated);
  };

  const updateOption = (nodeId, optionIndex, changes) => {
    const updated = nodes.map(n => {
      if (n.id === nodeId) {
        const newOptions = [...n.opciones];
        newOptions[optionIndex] = { ...newOptions[optionIndex], ...changes };
        return { ...n, opciones: newOptions };
      }
      return n;
    });
    setNodes(updated);
  };

  const deleteOption = (nodeId, optionIndex) => {
    const updated = nodes.map(n => {
      if (n.id === nodeId) {
        const newOptions = [...n.opciones];
        newOptions.splice(optionIndex, 1);
        return { ...n, opciones: newOptions };
      }
      return n;
    });
    setNodes(updated);
  };

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="page-content" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header and Toggle Card */}
      <div className="card glass-morphism" style={{ 
        padding: '32px', 
        borderRadius: '24px', 
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <h2 style={{ 
              fontSize: '28px', 
              fontWeight: '800', 
              margin: '0 0 8px 0',
              background: 'linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Módulo Chatbot
            </h2>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '15px' }}>
              Controla la atención automatizada al cliente.
            </p>
          </div>
          <div style={{ 
            width: '64px', 
            height: '64px', 
            background: isChatbotActive ? 'rgba(0, 210, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            border: `1px solid ${isChatbotActive ? 'rgba(0, 210, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
            transition: 'all 0.3s ease'
          }}>
            🤖
          </div>
        </div>

        <div style={{ 
          background: 'rgba(0,0,0,0.2)', 
          borderRadius: '16px', 
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <div>
            <h3 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '18px' }}>Estado del Chatbot</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px', maxWidth: '400px', lineHeight: '1.5' }}>
              {isChatbotActive 
                ? 'El Chatbot está interceptando los mensajes de soporte y respondiendo de forma automática.'
                : 'El Chatbot está desactivado. Los mensajes de soporte requerirán atención humana.'}
            </p>
          </div>
          
          <button 
            onClick={handleToggle}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              border: 'none',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.3s ease',
              background: isChatbotActive ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.1)',
              color: isChatbotActive ? '#000' : '#fff',
              boxShadow: isChatbotActive ? '0 0 20px rgba(0, 210, 255, 0.4)' : 'none'
            }}
          >
            {isChatbotActive ? 'ENCENDIDO' : 'APAGADO'}
            <div style={{
              width: '40px',
              height: '24px',
              background: isChatbotActive ? '#000' : 'rgba(0,0,0,0.5)',
              borderRadius: '12px',
              position: 'relative',
              padding: '2px'
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                background: isChatbotActive ? 'var(--accent-primary)' : '#fff',
                borderRadius: '50%',
                position: 'absolute',
                top: '2px',
                left: isChatbotActive ? '18px' : '2px',
                transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }} />
            </div>
          </button>
        </div>
      </div>

      {/* Builder Section */}
      <div className="card glass-morphism" style={{ padding: '32px', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h3 style={{ fontSize: '22px', margin: '0 0 8px 0', color: '#fff' }}>Flujo de Respuestas</h3>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '14px' }}>
              Construye el árbol de decisiones. El "Nodo Inicial" es el primer mensaje que verá el cliente.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={addNode}
              className="btn btn-secondary"
              style={{ borderRadius: '12px', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent' }}
              disabled={isSaving}
            >
              + Nuevo Nodo
            </button>
            <button 
              onClick={saveFlow}
              className="btn btn-primary"
              style={{ borderRadius: '12px', fontWeight: 'bold' }}
              disabled={isSaving}
            >
              {isSaving ? 'Guardando...' : '💾 Guardar Cambios'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {nodes.map((node) => (
            <div key={node.id} style={{
              background: 'rgba(0,0,0,0.2)',
              border: `1px solid ${node.id === 'root' ? 'rgba(0, 210, 255, 0.3)' : 'rgba(255,255,255,0.05)'}`,
              borderRadius: '16px',
              padding: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ 
                  background: node.id === 'root' ? 'rgba(0, 210, 255, 0.1)' : 'rgba(255,255,255,0.1)',
                  color: node.id === 'root' ? '#00d2ff' : '#fff',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  letterSpacing: '1px'
                }}>
                  {node.id === 'root' ? 'NODO INICIAL' : `NODO: ${node.id}`}
                </span>
                
                {node.id !== 'root' && (
                  <button onClick={() => deleteNode(node.id)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer' }}>
                    🗑️ Eliminar Nodo
                  </button>
                )}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Mensaje del Bot:</label>
                <textarea 
                  value={node.mensaje}
                  onChange={(e) => updateNode(node.id, { mensaje: e.target.value })}
                  style={{
                    width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px', padding: '12px', color: '#fff', fontSize: '14px', resize: 'vertical', minHeight: '80px'
                  }}
                  placeholder="Escribe el mensaje que enviará el bot..."
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>Botones de Respuesta (Opciones):</label>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
                  {node.opciones.map((opt, i) => (
                    <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px' }}>
                      <input 
                        type="text"
                        value={opt.texto}
                        onChange={(e) => updateOption(node.id, i, { texto: e.target.value })}
                        style={{
                          flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '14px'
                        }}
                        placeholder="Texto del botón"
                      />
                      <span style={{ color: 'var(--text-muted)' }}>➔</span>
                      <select
                        value={opt.siguiente_nodo_id}
                        onChange={(e) => updateOption(node.id, i, { siguiente_nodo_id: e.target.value })}
                        style={{
                          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '14px'
                        }}
                      >
                        <option value="humano">🧑‍💻 Hablar con un humano</option>
                        {nodes.map(n => (
                          <option key={n.id} value={n.id}>Nodo: {n.id === 'root' ? 'Inicial' : n.id}</option>
                        ))}
                      </select>
                      <button onClick={() => deleteOption(node.id, i)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '4px' }}>
                        ❌
                      </button>
                    </div>
                  ))}
                </div>
                
                <button 
                  onClick={() => addOption(node.id)}
                  style={{
                    background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.2)',
                    borderRadius: '8px', padding: '8px 16px', color: '#fff', fontSize: '13px', cursor: 'pointer'
                  }}
                >
                  + Agregar Botón
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
