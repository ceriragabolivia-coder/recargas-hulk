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
      
      // Restringir el OCR solo a números para que sea ultra rápido y preciso
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789',
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
export async function extractReferenceFromImage(file, excludedNumbers = []) {
  try {
    // Reutilizar el worker ya cargado (o esperar a que termine de cargar)
    const worker = await preloadOcrWorker();
    const result = await worker.recognize(file);

    const text = result.data.text;
    console.log("OCR Texto extraído (resumen de longitud):", text.length, "caracteres");

    // 1. Extraer todas las secuencias de 6 o más dígitos.
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
    const bestMatch = digitSequences[0];

    // 3. Retornar los ÚLTIMOS 6 dígitos de la secuencia seleccionada.
    const last6Digits = bestMatch.slice(-6);

    console.log("OCR Referencia detectada:", bestMatch, "->", last6Digits);
    return last6Digits;
  } catch (error) {
    console.error("Error procesando OCR:", error);
    return null;
  }
}

