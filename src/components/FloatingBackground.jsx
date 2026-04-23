import React, { useMemo, useEffect, useState } from 'react';
import { useConfiguracion } from '../hooks/useData';

export default function FloatingBackground() {
  const { config } = useConfiguracion();
  
  const isEnabled = config.bg_floating_enabled === 'true';
  const speed = parseFloat(config.bg_floating_speed || '10');
  const density = parseInt(config.bg_floating_density || '15');
  const size = parseInt(config.bg_floating_size || '80');
  
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

    const newElements = Array.from({ length: density }).map((_, i) => ({
      id: i,
      image: images[i % images.length],
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 20}s`,
      duration: `${(25 / (speed / 10)) + Math.random() * 10}s`,
      size: `${size + (Math.random() * 40)}px`,
      rotate: `${Math.random() * 360}deg`
    }));

    setElements(newElements);
  }, [isEnabled, images, density, speed, size]);

  if (!isEnabled || images.length === 0) return null;

  return (
    <div className="floating-background-container">
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
            transform: `rotate(${el.rotate})`
          }}
        >
          <img 
            src={el.image} 
            alt="" 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'contain',
              opacity: 0.6
            }} 
          />
        </div>
      ))}
    </div>
  );
}
