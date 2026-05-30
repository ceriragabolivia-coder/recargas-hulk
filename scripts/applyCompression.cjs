const fs = require('fs');
const path = require('path');

const files = [
  'src/components/Configuracion.jsx',
  'src/components/GestionLanding.jsx',
  'src/components/GestionProductos.jsx',
  'src/components/LandingPerfil.jsx',
  'src/components/LandingWallet.jsx',
  'src/components/Pedidos.jsx'
];

files.forEach(relPath => {
  const filePath = path.join(__dirname, '..', relPath);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');

  // Add import if not present
  if (!content.includes('compressImage')) {
    content = content.replace(
      "import { supabase } from '../lib/supabase'",
      "import { supabase } from '../lib/supabase'\nimport { compressImage } from '../utils/imageCompression'"
    );
  }

  // Replace supabase.storage.from(...).upload(path, file) 
  // We will do a generic replacement for simple cases.
  // Actually, since I can't guarantee a robust regex, it's better to do this manually via tools or a very careful regex.
});
