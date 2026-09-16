import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  Panel,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useConfiguracion } from '../hooks/useData';

const DEFAULT_FLOW = [
  {
    id: 'root',
    mensaje: 'Hola, Soy Dannielis, estoy aquí para ayudarte. Elige una opción:',
    opciones: []
  }
];

const CustomBotNode = ({ data, id }) => {
  return (
    <div style={{
      background: 'rgba(20,20,30,0.95)',
      border: `2px solid ${id === 'root' ? '#00d2ff' : 'rgba(255,255,255,0.2)'}`,
      borderRadius: '12px',
      padding: '16px',
      width: '300px',
      color: 'white',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px', color: id==='root' ? '#00d2ff' : '#aaa' }}>
        {id === 'root' ? 'RESPUESTA INICIAL' : (data.titulo || 'Nueva Respuesta').toUpperCase()}
      </div>

      {id !== 'root' && (
        <input 
          value={data.titulo || ''}
          onChange={(e) => data.onUpdateNode(id, { titulo: e.target.value })}
          placeholder="Título interno"
          className="nodrag"
          style={{ width: '100%', padding: '6px', marginBottom: '8px', borderRadius: '4px', border: '1px solid #444', background: '#1a1a2e', color: '#fff' }}
        />
      )}

      <textarea
        value={data.mensaje}
        onChange={(e) => data.onUpdateNode(id, { mensaje: e.target.value })}
        placeholder="Mensaje del bot..."
        className="nodrag"
        style={{ width: '100%', padding: '6px', marginBottom: '8px', borderRadius: '4px', border: '1px solid #444', background: '#1a1a2e', color: '#fff', resize: 'vertical', minHeight: '60px' }}
      />

      <div style={{ borderTop: '1px solid #333', marginTop: '12px', paddingTop: '12px' }}>
        <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>Botones de respuesta:</div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', fontStyle: 'italic' }}>
          * Conecta el punto azul de un botón a otro nodo para dirigir la conversación. Si no lo conectas, la opción redirigirá al Agente Humano automáticamente.
        </div>
        {data.opciones && data.opciones.map((opt, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '6px', position: 'relative' }}>
            <input 
              value={opt.texto}
              onChange={(e) => data.onUpdateOption(id, i, e.target.value)}
              className="nodrag"
              placeholder="Texto del botón"
              style={{ flex: 1, padding: '4px 8px', borderRadius: '4px', border: '1px solid #444', background: '#1a1a2e', color: '#fff', fontSize: '12px' }}
            />
            <button onClick={() => data.onDeleteOption(id, i)} style={{ marginLeft: '4px', background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer' }}>×</button>
            <Handle 
              type="source" 
              position={Position.Right} 
              id={`${i}`}
              style={{ top: '50%', right: '-24px', background: '#00d2ff', width: '12px', height: '12px' }}
            />
          </div>
        ))}
        <button 
          onClick={() => data.onAddOption(id)}
          style={{ width: '100%', padding: '4px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px dashed #555', color: '#fff', fontSize: '11px', marginTop: '4px', cursor: 'pointer' }}
        >
          + Agregar Botón
        </button>
      </div>
      
      {id !== 'root' && (
        <button onClick={() => data.onDeleteNode(id)} style={{ width: '100%', padding: '4px', background: 'none', border: 'none', color: '#ff4444', fontSize: '11px', marginTop: '12px', cursor: 'pointer' }}>
          🗑️ Eliminar Respuesta
        </button>
      )}
    </div>
  );
};

const Chatbot = () => {
  const { config, updateConfig, loading } = useConfiguracion();
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const nodeTypes = useMemo(() => ({ customBotNode: CustomBotNode }), []);

  // Initialize from config
  useEffect(() => {
    if (!loading && config && !initialized) {
      let parsedNodes = DEFAULT_FLOW;
      if (config.chatbot_flujo) {
        try {
          parsedNodes = JSON.parse(config.chatbot_flujo);
        } catch (e) {
          console.error("Error parsing chatbot flow", e);
        }
      }

      let layoutObj = {};
      if (config.chatbot_layout) {
        try {
          const l = JSON.parse(config.chatbot_layout);
          l.forEach(item => { layoutObj[item.id] = item.position; });
        } catch(e) {}
      }

      let initialNodes = [];
      let initialEdges = [];

      parsedNodes.forEach((n, idx) => {
        initialNodes.push({
          id: n.id,
          type: 'customBotNode',
          position: layoutObj[n.id] || { x: 250, y: idx * 300 },
          data: { 
            titulo: n.titulo, 
            mensaje: n.mensaje, 
            opciones: n.opciones || []
          }
        });

        if (n.opciones) {
          n.opciones.forEach((opt, optIdx) => {
            if (opt.siguiente_nodo_id && opt.siguiente_nodo_id !== 'humano') {
              initialEdges.push({
                id: `e_${n.id}_${optIdx}_${opt.siguiente_nodo_id}`,
                source: n.id,
                sourceHandle: `${optIdx}`,
                target: opt.siguiente_nodo_id,
                animated: true,
                interactionWidth: 25,
                style: { stroke: '#00d2ff', strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#00d2ff' },
              });
            }
          });
        }
      });

      setNodes(initialNodes);
      setEdges(initialEdges);
      setInitialized(true);
    }
  }, [loading, config, initialized, setNodes, setEdges]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ 
      ...params, 
      animated: true, 
      interactionWidth: 25,
      style: { stroke: '#00d2ff', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#00d2ff' }
    }, eds)),
    [setEdges],
  );

  const onEdgeClick = useCallback(
    (event, edge) => {
      // Borrar la línea al hacer clic en ella
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    },
    [setEdges]
  );

  const isChatbotActive = config?.chatbot_activo === 'true';

  const handleToggle = async () => {
    const newState = isChatbotActive ? 'false' : 'true';
    await updateConfig('chatbot_activo', newState, true);
  };

  const saveFlow = async () => {
    setIsSaving(true);
    
    // Convert React Flow to JSON
    const finalNodes = nodes.map(n => {
      const outEdges = edges.filter(e => e.source === n.id);
      
      const newOpciones = n.data.opciones.map((opt, optIdx) => {
        const edge = outEdges.find(e => e.sourceHandle === `${optIdx}`);
        return {
          texto: opt.texto,
          siguiente_nodo_id: edge ? edge.target : 'humano'
        };
      });
      
      return {
        id: n.id,
        titulo: n.data.titulo,
        mensaje: n.data.mensaje,
        opciones: newOpciones
      };
    });

    await updateConfig('chatbot_flujo', JSON.stringify(finalNodes), true);
    
    const layout = nodes.map(n => ({ id: n.id, position: n.position }));
    await updateConfig('chatbot_layout', JSON.stringify(layout), true);
    
    setIsSaving(false);
  };

  const addNode = () => {
    const newNode = {
      id: `nodo_${Date.now()}`,
      type: 'customBotNode',
      position: { x: 400, y: 100 },
      data: {
        titulo: 'Nueva Respuesta',
        mensaje: 'Nuevo mensaje del bot...',
        opciones: []
      }
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const onUpdateNode = useCallback((id, changes) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === id) {
          return { ...n, data: { ...n.data, ...changes } };
        }
        return n;
      })
    );
  }, [setNodes]);

  const onUpdateOption = useCallback((nodeId, optionIndex, newText) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          const newOpciones = [...n.data.opciones];
          newOpciones[optionIndex] = { ...newOpciones[optionIndex], texto: newText };
          return { ...n, data: { ...n.data, opciones: newOpciones } };
        }
        return n;
      })
    );
  }, [setNodes]);

  const onAddOption = useCallback((nodeId) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          return { ...n, data: { ...n.data, opciones: [...n.data.opciones, { texto: 'Nueva Opción', siguiente_nodo_id: 'humano' }] } };
        }
        return n;
      })
    );
  }, [setNodes]);

  const onDeleteOption = useCallback((nodeId, optionIndex) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          const newOpciones = [...n.data.opciones];
          newOpciones.splice(optionIndex, 1);
          return { ...n, data: { ...n.data, opciones: newOpciones } };
        }
        return n;
      })
    );
    setEdges((eds) => eds.filter(e => !(e.source === nodeId && e.sourceHandle === `${optionIndex}`)));
  }, [setNodes, setEdges]);
  
  const onDeleteNode = useCallback((id) => {
    if (id === 'root') return;
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }, [setNodes, setEdges]);

  // Inject callbacks into nodes
  const nodesWithHandlers = useMemo(() => {
    return nodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        onUpdateNode,
        onUpdateOption,
        onAddOption,
        onDeleteOption,
        onDeleteNode
      }
    }));
  }, [nodes, onUpdateNode, onUpdateOption, onAddOption, onDeleteOption, onDeleteNode]);

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="page-content" style={{ padding: '24px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header and Toggle Card */}
      <div className="card glass-morphism" style={{ 
        padding: '24px', 
        borderRadius: '24px', 
        border: '1px solid rgba(255, 255, 255, 0.1)',
        marginBottom: '20px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h2 style={{ 
              fontSize: '28px', 
              fontWeight: '800', 
              margin: '0 0 8px 0',
              background: 'linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Constructor Visual de Chatbot
            </h2>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '15px' }}>
              Controla la atención automatizada al cliente uniendo botones con respuestas mediante flechas.
            </p>
          </div>
          <button 
            onClick={handleToggle}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              border: 'none',
              fontSize: '14px',
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
            {isChatbotActive ? '🤖 ENCENDIDO' : 'APAGADO'}
          </button>
        </div>
      </div>

      {/* Builder Section */}
      <div className="card glass-morphism" style={{ flex: 1, borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.1)', overflow: 'hidden', position: 'relative' }}>
        <ReactFlow
          nodes={nodesWithHandlers}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          fitView
          colorMode="dark"
        >
          <Panel position="top-right" style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={addNode}
              className="btn btn-secondary"
              style={{ borderRadius: '12px', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.5)' }}
              disabled={isSaving}
            >
              + Nueva Respuesta
            </button>
            <button 
              onClick={saveFlow}
              className="btn btn-primary"
              style={{ borderRadius: '12px', fontWeight: 'bold' }}
              disabled={isSaving}
            >
              {isSaving ? 'Guardando...' : '💾 Guardar Cambios'}
            </button>
          </Panel>
          <Controls />
          <MiniMap nodeColor="#00d2ff" maskColor="rgba(0,0,0,0.7)" style={{ background: '#1a1a2e' }} />
          <Background variant="dots" gap={12} size={1} color="#444" />
        </ReactFlow>
      </div>
    </div>
  );
};

export default Chatbot;
