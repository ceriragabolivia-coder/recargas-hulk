import React, { useEffect, useRef, useState } from 'react';

/**
 * ConfettiCelebration
 * Muestra una lluvia de papelillos festivos (confetti) en pantalla completa durante 4 segundos.
 */
export default function ConfettiCelebration({ duration = 4000 }) {
  const canvasRef = useRef(null);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
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

    // Paleta de colores festivos (incluyendo el verde insignia de Hulk)
    const colors = [
      '#39ff14', // Verde Hulk eléctrico
      '#00d2ff', // Cian brillante
      '#ff007f', // Fucsia fiesta
      '#ffd700', // Dorado oro
      '#7b2ff7', // Púrpura neón
      '#ff6b6b', // Coral
      '#00f5d4', // Turquesa
      '#ffffff'  // Destello blanco
    ];

    // Crear partículas con física de caída realista
    const particleCount = 140;
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * -height * 0.4 - 20, // Empiezan arriba fuera de vista
        size: Math.random() * 8 + 6,
        length: Math.random() * 14 + 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3.5 + 2.5,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        swaySpeed: Math.random() * 0.04 + 0.02,
        swayAngle: Math.random() * Math.PI * 2,
        shape: Math.random() > 0.3 ? 'rect' : 'circle' // Rectángulos y círculos
      });
    }

    const startTime = performance.now();

    const loop = (currentTime) => {
      const elapsed = currentTime - startTime;

      if (elapsed >= duration) {
        ctx.clearRect(0, 0, width, height);
        setIsActive(false);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Desvanecimiento suave en el último medio segundo
      const fadeProgress = elapsed > duration - 600 ? (duration - elapsed) / 600 : 1;
      const opacity = Math.max(0, Math.min(1, fadeProgress));

      particles.forEach((p) => {
        p.swayAngle += p.swaySpeed;
        p.x += p.vx + Math.sin(p.swayAngle) * 1.8;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = opacity;
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          // Escala 3D tipo cinta que gira
          const cosScale = Math.cos((p.rotation * Math.PI) / 90);
          ctx.fillRect(-p.size / 2, (-p.length * cosScale) / 2, p.size, p.length * Math.abs(cosScale));
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [duration]);

  if (!isActive) return null;

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
