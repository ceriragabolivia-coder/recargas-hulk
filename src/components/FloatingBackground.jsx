import React, { useMemo, useEffect, useState } from 'react';
import { useConfiguracion } from '../hooks/useData';

export default function FloatingBackground() {
  const { config } = useConfiguracion();
  
  const isEnabled = config.bg_floating_enabled === 'true';
  const speed = parseFloat(config.bg_floating_speed || '10');
  const density = parseInt(config.bg_floating_density || '15');
  const size = parseInt(config.bg_floating_size || '80');
  const opacity = config.bg_floating_opacity || '0.4';
  
  const images = useMemo(() => {
    try {
      return JSON.parse(config.bg_floating_images || '[]');
    } catch (e) {
      return [];
    }
  }, [config.bg_floating_images]);

  const [elements, setElements] = useState([]);

  useEffect(() => {
    if (!isEnabled || images.length === 0) {
      setElements([]);
      return;
    }

    // Barajar las imágenes disponibles para evitar que aparezcan en el mismo orden
    const shuffledImages = [...images].sort(() => Math.random() - 0.5);
    
    // Crear bins (columnas) para asegurar que se distribuyan por todo el ancho sin amontonarse
    const numBins = density;
    const binWidth = 100 / numBins;

    const newElements = Array.from({ length: density }).map((_, i) => {
      // Posición horizontal dentro de su propia columna (bin)
      const binStart = i * binWidth;
      const left = binStart + (Math.random() * (binWidth * 0.8)); // 0.8 para dejar un margen entre columnas
      
      // Seleccionar imagen aleatoria o barajada
      const image = shuffledImages[i % shuffledImages.length];
      
      // Variación de escala y opacidad individual para profundidad
      const individualScale = 0.6 + Math.random() * 0.8; // entre 0.6x y 1.4x el tamaño base
      const individualOpacity = 0.3 + Math.random() * 0.7; // variación local sobre la opacidad base
      
      return {
        id: i,
        image: image,
        left: `${left}%`,
        delay: `${Math.random() * 25}s`, // Más dispersión en el tiempo
        duration: `${(25 / (speed / 10)) + Math.random() * 15}s`,
        size: `${size * individualScale}px`,
        rotate: `${Math.random() * 360}deg`,
        opacity: individualOpacity
      };
    });

    setElements(newElements);
  }, [isEnabled, images, density, speed, size]);

  if (!isEnabled || images.length === 0) return null;

  return (
    <div className="floating-background-container" style={{ '--float-opacity': opacity }}>
      {elements.map(el => (
        <div 
          key={el.id}
          className="floating-element"
          style={{
            left: el.left,
            width: el.size,
            height: el.size,
            animation: `float-up ${el.duration} linear infinite`,
            animationDelay: el.delay,
            transform: `rotate(${el.rotate})`,
            opacity: el.opacity
          }}
        >
          <img loading="lazy" decoding="async" src={el.image} 
            alt="" 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'contain'
            }} 
          />
        </div>
      ))}
    </div>
  );
}
