import React, { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'hulk_confetti_24h_v3';
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const MAX_SHOWS_PER_24H = 2;

/**
 * ConfettiCelebration
 * Lluvia de papelillos festivos (confetti) para todos los clientes y visitantes.
 * - Aparece exactamente hasta 2 veces cada 24 horas por cliente (vía localStorage).
 * - Las partículas caen de forma natural y completa hasta salir por la parte inferior de la pantalla.
 * - No desaparecen en medio de la caída.
 */
export default function ConfettiCelebration({ force = false }) {
  const canvasRef = useRef(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (force) {
      setShouldRender(true);
      return;
    }

    try {
      const now = Date.now();
      const raw = localStorage.getItem(STORAGE_KEY);
      let allowed = false;

      if (!raw) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ start: now, count: 1 }));
        allowed = true;
      } else {
        const data = JSON.parse(raw);
        if (!data.start || now - data.start >= TWENTY_FOUR_HOURS_MS) {
          // Ha transcurrido el ciclo de 24 horas: iniciamos nuevo ciclo con conteo 1
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ start: now, count: 1 }));
          allowed = true;
        } else if ((data.count || 0) < MAX_SHOWS_PER_24H) {
          // Dentro de las 24 horas y lleva menos de 2 visualizaciones
          data.count = (data.count || 0) + 1;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          allowed = true;
        } else {
          // Ya se mostró las 2 veces permitidas en las últimas 24 horas
          allowed = false;
        }
      }

      setShouldRender(allowed);
    } catch {
      setShouldRender(true);
    }
  }, [force]);

  useEffect(() => {
    if (!shouldRender) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Paleta festiva viva y visible
    const colors = [
      '#39ff14', // Verde neón Hulk
      '#00f0ff', // Cian brillante
      '#ff0077', // Fucsia intenso
      '#ffea00', // Amarillo dorado
      '#a855f7', // Violeta brillante
      '#ff5722', // Naranja fuego
      '#00e676', // Verde esmeralda
      '#ffffff'  // Blanco puro
    ];

    let particles = [];

    const createParticle = (customY = null) => {
      const isRect = Math.random() > 0.3;
      return {
        x: Math.random() * width,
        y: customY !== null ? customY : Math.random() * -120 - 20,
        width: Math.random() * 8 + 8,   // 8 a 16px
        height: Math.random() * 12 + 10, // 10 a 22px
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 2.5,
        vy: Math.random() * 2.5 + 2.0,   // Velocidad de caída
        gravity: 0.035,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 8,
        swaySpeed: Math.random() * 0.04 + 0.02,
        swayAngle: Math.random() * Math.PI * 2,
        shape: isRect ? 'rect' : 'circle'
      };
    };

    // Ola inicial abundante de 140 papelillos
    for (let i = 0; i < 140; i++) {
      particles.push(createParticle(Math.random() * -height * 0.5 - 10));
    }

    // Ola secundaria al cabo de 0.8s para dar volumen continuo
    const waveTimeout = setTimeout(() => {
      for (let i = 0; i < 60; i++) {
        particles.push(createParticle(-30));
      }
    }, 800);

    const loop = () => {
      ctx.clearRect(0, 0, width, height);

      const remainingParticles = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.vy += p.gravity;
        p.swayAngle += p.swaySpeed;
        p.x += p.vx + Math.sin(p.swayAngle) * 1.8;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          // Efecto de volteo 3D
          const cosScale = Math.cos((p.rotation * Math.PI) / 90);
          ctx.fillRect(-p.width / 2, (-p.height * cosScale) / 2, p.width, p.height * Math.abs(cosScale));
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.width / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();

        // El papelillo SOLO desaparece cuando atraviesa y sale por abajo de la pantalla
        if (p.y <= height + 50) {
          remainingParticles.push(p);
        }
      }

      particles = remainingParticles;

      if (particles.length > 0) {
        animId = requestAnimationFrame(loop);
      } else {
        // Todas las partículas terminaron de caer completamente por abajo
        ctx.clearRect(0, 0, width, height);
        setShouldRender(false);
      }
    };

    animId = requestAnimationFrame(loop);

    return () => {
      clearTimeout(waveTimeout);
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [shouldRender]);

  if (!shouldRender) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 99999999
      }}
    />
  );
}
