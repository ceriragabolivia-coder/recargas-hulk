import { createWorker } from 'tesseract.js';

let workerPromise = null;

/**
 * Pre-inicializa el worker de Tesseract en segundo plano para que esté listo cuando se necesite.
 */
export function preloadOcrWorker() {
  if (!workerPromise) {
    console.log("🚀 Pre-cargando OCR Worker en segundo plano...");
    workerPromise = (async () => {
      const worker = await createWorker('eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text' && m.progress % 0.2 < 0.05) {
            console.log(`OCR Progreso: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      
      // Optimizamos para comprobantes (texto disperso)
      await worker.setParameters({
        tessedit_pageseg_mode: '11',
      });
      
      return worker;
    })();
  }
  return workerPromise;
}

// Iniciar carga inmediatamente al cargar el módulo
preloadOcrWorker();

/**
 * Procesa una imagen de comprobante y extrae los últimos 6 dígitos de la posible referencia.
 * @param {File} file - Archivo de imagen seleccionado por el usuario.
 * @param {Array<string|number>} excludedNumbers - (Opcional) Números a ignorar si el OCR los detecta (ej. Cédula o Teléfono).
 * @returns {Promise<string|null>} - Retorna los 6 dígitos detectados o null si no se detecta ninguno válido.
 */
export async function extractReferenceFromImage(file, excludedNumbers = [], returnFull = false) {
  try {
    // Reutilizar el worker ya cargado (o esperar a que termine de cargar)
    const worker = await preloadOcrWorker();
    const result = await worker.recognize(file);

    const text = result.data.text;
    console.log("OCR Texto extraído (resumen de longitud):", text.length, "caracteres");

    // 1. Buscar explícitamente la palabra "referencia" o "ref" seguida de números
    // Esto previene que tome horas (ej. 10:51:44 -> 105144) o fechas
    const refMatch = text.match(/ref[a-z]*[^0-9]{0,15}(\d{6,})/i);
    if (refMatch && refMatch[1]) {
      console.log("OCR Encontrado por palabra clave 'ref':", refMatch[1]);
      return returnFull ? refMatch[1] : refMatch[1].slice(-6);
    }

    // 2. Si no encuentra la palabra clave, extraemos todas las secuencias de 6 o más dígitos.
    let digitSequences = text.match(/\d{6,}/g);

    if (!digitSequences || digitSequences.length === 0) {
      return null;
    }

    // Convertir los números excluidos a string eliminando espacios/guiones, y mantener solo aquellos que tienen más de 5 dígitos (ya que secuencias menores a 6 no importan aquí)
    const normalizedExclusions = excludedNumbers
      .filter(Boolean)
      .map(num => String(num).replace(/\D/g, ''))
      .filter(numStr => numStr.length >= 6);

    // Filtrar las secuencias detectadas: ignorar si la secuencia CONTIENE o ES un número excluido.
    if (normalizedExclusions.length > 0) {
      digitSequences = digitSequences.filter(seq => {
        // Ignorar la secuencia si es la cédula o el teléfono (o si es parte de ellos).
        return !normalizedExclusions.some(exclusion => seq.includes(exclusion) || exclusion.includes(seq));
      });
    }

    if (digitSequences.length === 0) {
      console.log("OCR: Todas las secuencias detectadas fueron excluidas (coinciden con cédula o teléfono).");
      return null;
    }

    // 2. Heurística: En los comprobantes, la referencia suele ser el número más largo
    digitSequences.sort((a, b) => b.length - a.length);
    let bestMatch = digitSequences[0];

    // FIX INTELIGENTE: Diferenciar un '0' real de un ícono de copiar (ej. Banco de Venezuela)
    if (bestMatch.endsWith('0') && bestMatch.length > 6) {
      const word = result.data.words?.find(w => w.text.includes(bestMatch));
      if (word && word.symbols) {
        // Encontrar los símbolos que corresponden a la secuencia de dígitos
        const symbolsMatch = word.symbols.filter(s => /\d/.test(s.text));
        const len = symbolsMatch.length;
        
        if (len >= 3) {
          const lastSymbol = symbolsMatch[len - 1];
          const secondLast = symbolsMatch[len - 2];
          
          // 1. Verificar el espacio (gap) entre el último dígito y el supuesto '0'
          const gapLast = lastSymbol.bbox.x0 - secondLast.bbox.x1;
          const charWidth = secondLast.bbox.x1 - secondLast.bbox.x0;
          const isLargeGap = gapLast > (charWidth * 0.4); // Si el espacio es más del 40% del ancho de un número
          
          // 2. Verificar si el tamaño (altura) es muy diferente a los demás números
          const lastHeight = lastSymbol.bbox.y1 - lastSymbol.bbox.y0;
          const prevHeight = secondLast.bbox.y1 - secondLast.bbox.y0;
          const isDifferentSize = Math.abs(lastHeight - prevHeight) / prevHeight > 0.2;
          
          // 3. Confianza del OCR para ese caracter específico
          const isLowConfidence = lastSymbol.confidence < 75;
          
          if (isLargeGap || isDifferentSize || isLowConfidence) {
            console.log(`OCR: El '0' final parece un ícono (gap:${isLargeGap}, size:${isDifferentSize}, conf:${lastSymbol.confidence}). Recortando...`);
            bestMatch = bestMatch.slice(0, -1);
          }
        }
      }
    }

    // 3. Retornar los ÚLTIMOS 6 dígitos o toda la secuencia
    const finalResult = returnFull ? bestMatch : bestMatch.slice(-6);

    console.log("OCR Referencia detectada:", bestMatch, "->", finalResult);
    return finalResult;
  } catch (error) {
    console.error("Error procesando OCR:", error);
    return null;
  }
}

