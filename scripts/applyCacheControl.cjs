const fs = require('fs');

function updateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');

  if (!content.includes('import { compressImage }') && !content.includes('import {compressImage}')) {
    content = content.replace(/(import .* from '\.\.\/lib\/supabase')/g, "$1\nimport { compressImage } from '../utils/imageCompression'");
  }

  content = content.replace(/\.upload\(([^,]+),\s*(file|newIconFile|newInfoFile|finalFile|pngBlob)\)/g, ".upload($1, await compressImage($2), { cacheControl: '31536000', upsert: true })");

  content = content.replace(/\.upload\(([^,]+),\s*(file|newIconFile|newInfoFile|finalFile|pngBlob),\s*\{\s*contentType\s*(?::\s*'[^']+')?\s*\}\)/g, ".upload($1, await compressImage($2), { cacheControl: '31536000', upsert: true })");

  fs.writeFileSync(filePath, content);
  console.log('Updated', filePath);
}

updateFile('src/components/GestionProductos.jsx');
updateFile('src/components/Configuracion.jsx');
