import Tesseract from 'tesseract.js';

/**
 * Procesa una imagen de comprobante y extrae los últimos 6 dígitos de la posible referencia.
 * @param {File} file - Archivo de imagen seleccionado por el usuario.
 * @returns {Promise<string|null>} - Retorna los 6 dígitos detectados o null si no se detecta ninguno válido.
 */
export async function extractReferenceFromImage(file) {
  try {
    // Usaremos 'spa' (español) para un mejor reconocimiento de los comprobantes locales.
    // Usamos el logger para poder depurar o mostrar progreso si fuera necesario.
    const result = await Tesseract.recognize(file, 'spa', {
      logger: m => console.log(m)
    });

    const text = result.data.text;
    console.log("OCR Texto extraído:", text);

    // 1. Extraer todas las secuencias de 6 o más dígitos.
    // Usamos \d{6,} para atrapar cualquier número de 6 o más dígitos consecutivos.
    const digitSequences = text.match(/\d{6,}/g);

    if (!digitSequences || digitSequences.length === 0) {
      return null;
    }

    // 2. Heurística: En los comprobantes, la referencia suele ser el número más largo, 
    // o al menos uno de los que tiene 6+ dígitos. 
    // Vamos a ordenar por longitud (de mayor a menor) para priorizar el más largo.
    digitSequences.sort((a, b) => b.length - a.length);

    // Seleccionamos el más largo. Si hay varios iguales, tomamos el primero.
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
