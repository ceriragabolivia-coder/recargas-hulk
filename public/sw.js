// Service Worker básico para permitir la instalación de la PWA
const CACHE_NAME = 'ceriraga-app-v1';

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activado.');
});

// Estrategia de red preferida: intenta cargar de red, si falla no hace nada especial (por ahora)
// Esto cumple con el requisito de tener un fetch handler para ser "instalable"
self.addEventListener('fetch', (event) => {
  // Solo interceptar peticiones de nuestro propio origen
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Aquí podrías retornar una página offline si fuera necesario
        return new Response('Sin conexión a internet');
      })
    );
  }
});
