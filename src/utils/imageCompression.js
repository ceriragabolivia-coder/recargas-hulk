import imageCompression from 'browser-image-compression';

/**
 * Comprime una imagen antes de subirla para optimizar el almacenamiento y ancho de banda.
 * Mantiene una buena calidad visual reduciendo el tamaño del archivo significativamente.
 * @param {File} file El archivo de imagen original
 * @returns {Promise<File>} El archivo comprimido
 */
export const compressImage = async (file) => {
  // Si no es imagen o es un SVG, lo devolvemos tal cual (los SVG ya son ligeros)
  if (!file || !file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file;
  }

  const options = {
    maxSizeMB: 0.5,          // Tamaño máximo de 500KB por imagen (suficiente para alta calidad web)
    maxWidthOrHeight: 1200,  // Resolución máxima de 1200px
    useWebWorker: true,      // Usar un hilo separado para no bloquear la UI
    fileType: 'image/webp',  // Convertir a formato WebP por defecto que es muy ligero
    initialQuality: 0.85     // Calidad inicial del 85% para balancear peso y visibilidad
  };

  try {
    const compressedFile = await imageCompression(file, options);
    
    // browser-image-compression devuelve un Blob, necesitamos convertirlo a File 
    // para mantener compatibilidad con las funciones de Supabase Upload
    // Retenemos el nombre original pero cambiamos la extension a .webp si fue convertido
    let newName = file.name;
    if (compressedFile.type === 'image/webp' && !newName.endsWith('.webp')) {
      newName = newName.substring(0, newName.lastIndexOf('.')) + '.webp';
    }

    return new File([compressedFile], newName, { type: compressedFile.type });
  } catch (error) {
    console.error('Error comprimiendo la imagen:', error);
    // En caso de fallo, devolvemos la original para que la subida no falle
    return file;
  }
};
