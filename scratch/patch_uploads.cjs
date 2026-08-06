const fs = require('fs');
let code = fs.readFileSync('src/components/GestionProductos.jsx', 'utf-8');

// replace: const fileName = `prod-new-${Date.now()}${shouldRemoveBg ? '.png' : ''}`
code = code.replace(/const fileName = `prod-new-\$\{Date\.now\(\)\}\$\{shouldRemoveBg \? '\.png' : ''\}`/g, 
  "const fileName = `prod-new-${Date.now()}.${finalFile.name ? finalFile.name.split('.').pop() : (contentType === 'image/webp' ? 'webp' : 'png')}`");

// replace: contentType = 'image/png'
code = code.replace(/contentType = 'image\/png'/g, "contentType = finalFile.type || 'image/png'");

// replace: const fileName = `prod-${juegoId}-${Date.now()}.png`
code = code.replace(/const fileName = `prod-\$\{juegoId\}-\$\{Date\.now\(\)\}\.png`/g, 
  "const fileName = `prod-${juegoId}-${Date.now()}.${finalFile.name ? finalFile.name.split('.').pop() : 'png'}`");

// replace: const fileName = `bulk-${Date.now()}-${i}.png`
code = code.replace(/const fileName = `bulk-\$\{Date\.now\(\)\}-\$\{i\}\.png`/g,
  "const fileName = `bulk-${Date.now()}-${i}.${finalFile.name ? finalFile.name.split('.').pop() : 'png'}`");

fs.writeFileSync('src/components/GestionProductos.jsx', code);
console.log('GestionProductos.jsx patched');

let conf = fs.readFileSync('src/components/Configuracion.jsx', 'utf-8');
conf = conf.replace(/const path = `payment-icons\/\$\{Date\.now\(\)\}\.png`/g,
  "const path = `payment-icons/${Date.now()}.${pngBlob.name ? pngBlob.name.split('.').pop() : 'png'}`");
conf = conf.replace(/const path = `logos\/logo-\$\{Date\.now\(\)\}\.png`/g,
  "const path = `logos/logo-${Date.now()}.${pngBlob.name ? pngBlob.name.split('.').pop() : 'png'}`");
conf = conf.replace(/const path = `logos\/favicon-\$\{Date\.now\(\)\}\.png`/g,
  "const path = `logos/favicon-${Date.now()}.${pngBlob.name ? pngBlob.name.split('.').pop() : 'png'}`");
conf = conf.replace(/const path = `backgrounds\/bg-\$\{Date\.now\(\)\}\.png`/g,
  "const path = `backgrounds/bg-${Date.now()}.${pngBlob.name ? pngBlob.name.split('.').pop() : 'png'}`");

fs.writeFileSync('src/components/Configuracion.jsx', conf);
console.log('Configuracion.jsx patched');
