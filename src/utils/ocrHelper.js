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
 * @returns {Promise<string|null>} - Retorna los 6 dígitos detectados o null si no se detecta ninguno válido.
 */
export async function extractReferenceFromImage(file) {
  try {
    // Reutilizar el worker ya cargado (o esperar a que termine de cargar)
    const worker = await preloadOcrWorker();
    const result = await worker.recognize(file);

    const text = result.data.text;
    console.log("OCR Texto extraído (resumen de longitud):", text.length, "caracteres");

    // 1. Extraer todas las secuencias de 6 o más dígitos.
    const digitSequences = text.match(/\d{6,}/g);

    if (!digitSequences || digitSequences.length === 0) {
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

