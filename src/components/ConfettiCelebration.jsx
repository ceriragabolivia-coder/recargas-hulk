import React, { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'hulk_celebration_confetti_last_shown';
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * ConfettiCelebration
 * Lluvia de papelillos festivos (confetti) para todos los visitantes.
 * - Se muestra únicamente 1 vez cada 24 horas por cliente (vía localStorage).
 * - Las partículas caen de forma natural y terminan su recorrido completo saliendo por abajo.
 * - No desaparecen en medio de la caída.
 */
export default function ConfettiCelebration({ force = false }) {
  const canvasRef = useRef(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    try {
      if (force) {
        setShouldRender(true);
        return;
      }
      const lastShown = localStorage.getItem(STORAGE_KEY);
      const now = Date.now();
      if (!lastShown || now - parseInt(lastShown, 10) >= TWENTY_FOUR_HOURS_MS) {
        localStorage.setItem(STORAGE_KEY, now.toString());
        setShouldRender(true);
      } else {
        setShouldRender(false);
      }
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
    const dpr = window.devicePixelRatio || 1;
    let width = window.innerWidth;
    let height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const handleResize = () => {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    window.addEventListener('resize', handleResize);

    // Paleta de colores festivos vivos (incluye el verde insignia Hulk)
    const colors = [
      '#39ff14', // Verde Hulk
      '#00d2ff', // Cian neón
      '#ff007f', // Fucsia
      '#ffd700', // Dorado
      '#7b2ff7', // Púrpura eléctrico
      '#ff6b6b', // Coral
      '#00f5d4', // Turquesa
      '#ffffff'  // Blanco brillo
    ];

    let particles = [];

    const createParticle = (customY = null) => {
      const isRect = Math.random() > 0.35;
      return {
        x: Math.random() * width,
        y: customY !== null ? customY : Math.random() * -80 - 20,
        size: Math.random() * 8 + 6,
        length: Math.random() * 14 + 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 3,
        vy: Math.random() * 2.5 + 2.0, // Velocidad de caída natural
        gravity: 0.035, // Gravedad suave
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 8,
        swaySpeed: Math.random() * 0.04 + 0.02,
        swayAngle: Math.random() * Math.PI * 2,
        shape: isRect ? 'rect' : 'circle'
      };
    };

    // Ola inicial: 120 papelillos distribuidos arriba
    for (let i = 0; i < 120; i++) {
      particles.push(createParticle(Math.random() * -200 - 10));
    }

    // Olas sucesivas durante los primeros 2 segundos para dar volumen
    const wave1 = setTimeout(() => {
      for (let i = 0; i < 60; i++) {
        particles.push(createParticle(-30));
      }
    }, 700);

    const wave2 = setTimeout(() => {
      for (let i = 0; i < 40; i++) {
        particles.push(createParticle(-30));
      }
    }, 1500);

    const loop = () => {
      ctx.clearRect(0, 0, width, height);

      // Actualizar y filtrar partículas que sigan dentro o por encima de la pantalla
      const remainingParticles = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.vy += p.gravity;
        p.swayAngle += p.swaySpeed;
        p.x += p.vx + Math.sin(p.swayAngle) * 1.6;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        // Dibujar partícula
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          const cosScale = Math.cos((p.rotation * Math.PI) / 90);
          ctx.fillRect(-p.size / 2, (-p.length * cosScale) / 2, p.size, p.length * Math.abs(cosScale));
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();

        // Conservar solo si NO ha terminado de caer (por debajo de la pantalla + margen)
        if (p.y <= height + 60) {
          remainingParticles.push(p);
        }
      }

      particles = remainingParticles;

      // Si aún quedan partículas cayendo, continuar la animación
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
      clearTimeout(wave1);
      clearTimeout(wave2);
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
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 9999999
      }}
    />
  );
}
