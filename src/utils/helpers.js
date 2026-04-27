/**
 * Replica exacta de las fórmulas del Excel para calcular precios
 */
export function calcularPrecioVenta(producto, juego, config, perfilUsuario = null) {
  const { costo_base, margen_ganancia, precio_venta_fijo } = producto
  const { tipo_calculo, descuento_particular = 0 } = juego
  const { tasa_binance, tasa_dolar, descuentos = 0, porcentaje_paypal = 0.08 } = config || {}
  
  let tasa = Number(tasa_binance || tasa_dolar || 1)
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
  return `$${Number(value || 0).toFixed(2)}`
}

export function formatBs(value) {
  const num = Math.round(Number(value || 0))
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + 'Bs'
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
  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3')
  audio.play().catch(err => console.log('Error al reproducir sonido:', err))
}

export function playSuccessSound() {
  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3') // Un sonido de "campanita" de éxito
  audio.play().catch(err => console.log('Error al reproducir sonido de éxito:', err))
}

export function playErrorSound() {
  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2955/2955-preview.mp3') // Sonido de error/zumbador
  audio.play().catch(err => console.log('Error al reproducir sonido de error:', err))
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
