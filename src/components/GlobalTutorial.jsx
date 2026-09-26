import React, { useState, useEffect, useRef } from 'react';
import { useAuth, useConfiguracion } from '../hooks/useData';
import { supabase } from '../lib/supabase';
import MandatoryTutorialModal from './MandatoryTutorialModal';
import MandatoryFlyerModal from './MandatoryFlyerModal';

export default function GlobalTutorial() {
  const { user, perfil } = useAuth();
  const { config } = useConfiguracion();
  
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [showFlyerModal, setShowFlyerModal] = useState(false);

  const isAdmin = perfil?.rol === 'admin' || perfil?.rol === 'administrador' || perfil?.roles?.includes('admin');
  const isNegocio = perfil?.rol === 'negocio' || perfil?.roles?.includes('negocio');
  const isEmpleado = perfil?.rol === 'empleado' || perfil?.rol === 'trabajador' || perfil?.roles?.includes('empleado');
  const isSocio = perfil?.rol === 'socio' || perfil?.roles?.includes('socio');
  
  const isClienteORevendedor = user && !isAdmin && !isNegocio && !isEmpleado && !isSocio;

  useEffect(() => {
    if (!perfil?.id || !config) return;
    if (!isClienteORevendedor) return;

    // Esperar 1 segundo antes de mostrar cualquier modal para asegurar que todo haya renderizado
    const timer = setTimeout(() => {
      // 1. Evaluar Video Tutorial (Prioridad 1)
      const isTutorialActive = config.tutorial_obligatorio_activo === 'true' && config.tutorial_obligatorio_url;
      // Asumimos no visto si es null o false
      const hasSeenTutorial = perfil.tutorial_obligatorio_visto === true;

      // 2. Evaluar Flyer (Prioridad 2)
      const isFlyerActive = config.flyer_obligatorio_activo === 'true' && config.flyer_obligatorio_url;
      const currentFlyerVersion = Number(config.flyer_obligatorio_version) || 0;
      const userFlyerVersion = Number(perfil.flyer_visto_version) || 0;
      const hasSeenCurrentFlyer = userFlyerVersion >= currentFlyerVersion;

      if (isTutorialActive && !hasSeenTutorial) {
        setShowTutorialModal(true);
        setShowFlyerModal(false);
      } else if (isFlyerActive && !hasSeenCurrentFlyer) {
        setShowTutorialModal(false);
        setShowFlyerModal(true);
      } else {
        setShowTutorialModal(false);
        setShowFlyerModal(false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    perfil?.id, 
    config, 
    isClienteORevendedor,
    perfil?.tutorial_obligatorio_visto,
    perfil?.flyer_visto_version
  ]);

  const handleTutorialComplete = async () => {
    try {
      const { data, error } = await supabase.rpc('marcar_tutorial_visto_rpc', {
        p_user_id: perfil.id
      });
      if (error) throw error;
      setShowTutorialModal(false);
      
      // Actualizamos el contexto local
      // Esto disparará el useEffect de nuevo y si hay un flyer pendiente, lo mostrará.
      if (perfil) perfil.tutorial_obligatorio_visto = true;
    } catch (err) {
      console.error("Error al marcar tutorial como visto:", err);
    }
  };

  const handleFlyerComplete = async () => {
    try {
      const currentVersion = Number(config.flyer_obligatorio_version) || 0;
      const { data, error } = await supabase.rpc('marcar_flyer_visto_rpc', {
        p_user_id: perfil.id,
        p_version: currentVersion
      });
      if (error) throw error;
      setShowFlyerModal(false);
      if (perfil) perfil.flyer_visto_version = currentVersion;
    } catch (err) {
      console.error("Error al marcar flyer como visto:", err);
    }
  };

  if (!showTutorialModal && !showFlyerModal) return null;

  return (
    <>
      <MandatoryTutorialModal
        isOpen={showTutorialModal}
        videoUrl={config.tutorial_obligatorio_url}
        title={config.tutorial_obligatorio_titulo}
        onComplete={handleTutorialComplete}
      />
      <MandatoryFlyerModal
        isOpen={showFlyerModal}
        flyerUrl={config.flyer_obligatorio_url}
        durationSecs={Number(config.flyer_obligatorio_duracion) || 5}
        onComplete={handleFlyerComplete}
      />
    </>
  );
}
