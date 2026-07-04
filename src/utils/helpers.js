// Un usuario puede tener varios roles (rol principal + roles adicionales asignados por un admin)
export function hasRole(perfil, ...roles) {
  const rolesUsuario = perfil?.roles || [perfil?.rol?.toLowerCase()]
  return roles.some(r => rolesUsuario.includes(r))
}

/**
 * Replica exacta de las fórmulas del Excel para calcular precios
 */
export function calcularPrecioVenta(producto, juego, config, perfilUsuario = null) {
  const { costo_base, margen_ganancia, precio_venta_fijo } = producto
  const { tipo_calculo, descuento_particular = 0 } = juego
  const { tasa_binance, tasa_dolar, descuentos = 0, porcentaje_paypal = 0.08 } = config || {}
  
  let tasa = Number(tasa_dolar || tasa_binance || 1)
  if (tasa <= 0) tasa = 1

  const aplicarDescuentoRevendedor = (precio) => {
    if (perfilUsuario?.rol === 'revendedor') {
      // 1. Prioridad: Descuento específico del producto
      // 2. Prioridad: Descuento global del juego
      // 3. Fallback: Descuento individual del perfil del usuario
      const descProducto = parseFloat(producto.descuento_revendedor || 0)
      const descJuego = parseFloat(juego.descuento_revendedor || 0)
      const descPerfil = parseFloat(perfilUsuario.porcentaje_descuento || 0)

      let discountPercent = 0
      if (descProducto > 0) {
        discountPercent = descProducto
      } else if (descJuego > 0) {
        discountPercent = descJuego
      } else {
        discountPercent = descPerfil
      }

      if (discountPercent > 0) {
        let nuevoPrecio = precio * (1 - (discountPercent / 100))
        if (nuevoPrecio < costo_base) nuevoPrecio = costo_base // Proteger el costo
        return nuevoPrecio
      }
    }
    return precio
  }

  if (precio_venta_fijo) {
    const venta_final = aplicarDescuentoRevendedor(precio_venta_fijo)
    return {
      venta_usd: +venta_final.toFixed(2),
      venta_bs: Math.round(venta_final * tasa),
      ganancia_usd: +(venta_final - costo_base).toFixed(2),
      tasa_usada: tasa
    }
  }

  let venta_usd
  switch (tipo_calculo) {
    case 'estandar':
    case 'paypal':
    case 'multiplicador':
    case 'ref_cruzada':
      venta_usd = costo_base + (costo_base * margen_ganancia)
      break
    case 'descuento_doble':
      venta_usd = costo_base + (costo_base * margen_ganancia) - descuentos - descuento_particular
      break
    default:
      venta_usd = costo_base + (costo_base * margen_ganancia)
  }

  venta_usd = aplicarDescuentoRevendedor(venta_usd)

  return {
    venta_usd: +venta_usd.toFixed(2),
    venta_bs: Math.round(venta_usd * tasa),
    ganancia_usd: +(venta_usd - costo_base).toFixed(2),
    tasa_usada: tasa
  }
}

export function formatUSD(value) {
  const [int, dec] = Number(value || 0).toFixed(2).split(".")
  const protectedInt = int.split("").join("\u200C")
  return `$\u200C${protectedInt}\u2024\u200C${dec}`
}

export function formatBs(value) {
  const num = Math.round(Number(value || 0)).toString()
  let result = ""
  for (let i = 0; i < num.length; i++) {
    const posFromEnd = num.length - i
    result += num[i]
    if (posFromEnd > 1) {
      if ((posFromEnd - 1) % 3 === 0) {
        result += "\u2024\u200C" // Punto de miles protegido
      } else {
        result += "\u200C" // Rompemos la secuencia numérica
      }
    }
  }
  return `${result} B\u200Cs`
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-VE')
}

// Utility to get YYYY-MM-DD in local timezone instead of UTC
export function getLocalDateString(date = new Date()) {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().split('T')[0];
}

export function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  return `${h12}:${m} ${ampm}`
}

export function playCashRegisterSound() {
  if (localStorage.getItem('admin_sound_enabled') === 'false') return;
  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3')
  audio.play().catch(err => console.log('Error al reproducir sonido:', err))
}

export function playSuccessSound() {
  if (localStorage.getItem('admin_sound_enabled') === 'false') return;
  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3') // Un sonido de "campanita" de éxito
  audio.play().catch(err => console.log('Error al reproducir sonido de éxito:', err))
}

export function playErrorSound() {
  if (localStorage.getItem('admin_sound_enabled') === 'false') return;
  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2955/2955-preview.mp3') // Sonido de error/zumbador
  audio.play().catch(err => console.log('Error al reproducir sonido de error:', err))
}

export function playAdminWelcomeSound() {
  if (localStorage.getItem('admin_sound_enabled') === 'false') return;
  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3')
  audio.play().catch(err => console.log('Error al reproducir audio de bienvenida:', err))
}

export function playOrderNotificationSound() {
  if (localStorage.getItem('admin_sound_enabled') === 'false') {
    console.log("Audio notificado cancelado: admin_sound_enabled es false");
    return;
  }
  
  console.log("Intentando reproducir sonido de nuevo pedido...");
  let audioEl = document.getElementById('hulk-notification-audio');
  if (!audioEl) {
    audioEl = document.createElement('audio');
    audioEl.id = 'hulk-notification-audio';
    document.body.appendChild(audioEl);
  }
  
  // Usar timestamp o versión para asegurar la descarga del archivo más reciente
  audioEl.src = '/sounds/nuevo_pedido.mp3?v=' + Date.now();
  
  const playPromise = audioEl.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      console.log("Audio reproducido exitosamente.");
    }).catch(err => {
      console.warn("Bloqueo de autoplay o error al reproducir audio:", err);
      // Fallback intentando con el constructor simple si el DOM falla
      const fallbackAudio = new Audio('/sounds/nuevo_pedido.mp3?v=' + Date.now());
      fallbackAudio.play().catch(e => console.error("Fallback audio falló también:", e));
    });
  }
}

export function playClientOrderSuccessSound() {
  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3')
  audio.play().catch(err => console.log('Error al reproducir sonido de éxito de pedido:', err))
}

export function playClientWelcomeSound() {
  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3')
  audio.play().catch(err => console.log('Error al reproducir sonido de bienvenida cliente:', err))
}

/**
 * Elimina el fondo blanco solo si está conectado a los bordes (Flood Fill).
 * Optimizado para evitar bloqueos del navegador en imágenes grandes.
 */
export function removeWhiteBackground(file, threshold = 240) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      const w = canvas.width
      const h = canvas.height

      const visited = new Uint8Array(w * h)
      // Usamos una pila (stack) con pop() que es O(1) en JS, 
      // transformando el BFS en DFS pero mucho más rápido.
      const stack = []

      const checkAndPush = (x, y) => {
        const idx = y * w + x
        if (visited[idx]) return
        const p = idx * 4
        if (data[p] >= threshold && data[p+1] >= threshold && data[p+2] >= threshold) {
          visited[idx] = 1
          data[p+3] = 0 // Alfa transparente
          stack.push(x, y)
        }
      }

      // Semillas iniciales: bordes
      for (let x = 0; x < w; x++) {
        checkAndPush(x, 0)
        checkAndPush(x, h - 1)
      }
      for (let y = 1; y < h - 1; y++) {
        checkAndPush(0, y)
        checkAndPush(w - 1, y)
      }

      while (stack.length > 0) {
        const y = stack.pop()
        const x = stack.pop()

        if (x > 0) checkAndPush(x - 1, y)
        if (x < w - 1) checkAndPush(x + 1, y)
        if (y > 0) checkAndPush(x, y - 1)
        if (y < h - 1) checkAndPush(x, y + 1)
      }

      ctx.putImageData(imageData, 0, 0)
      canvas.toBlob(blob => {
        if (blob) resolve(blob)
        else reject(new Error('Error al convertir imagen'))
      }, 'image/png')
    }
    img.onerror = () => reject(new Error('Error al cargar imagen'))
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Optimiza las URLs de imágenes de Supabase usando Image Transformations.
 * Cambia /object/public/ a /render/image/public/ y agrega los query params de tamaño.
 * @param {string} url La URL original de la imagen
 * @param {number} width Ancho deseado en píxeles (default 300)
 * @param {number} quality Calidad de compresión webp (default 80)
 * @returns {string} URL optimizada o la URL original si no es de Supabase Storage
 */
export function getOptimizedImageUrl(url, width = 300, quality = 80) {
  // Desactivado para evitar límites de cuota de transformaciones de Supabase Pro Plan.
  // Las imágenes ya se comprimen localmente antes de subirlas gracias a compressImage().
  return url;
}
