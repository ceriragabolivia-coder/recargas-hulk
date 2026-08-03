const fs = require('fs');
let code = fs.readFileSync('src/components/LandingPerfil.jsx', 'utf8');

code = code.replace(/juego\.logo_url/g, 'juego.icono_url');

fs.writeFileSync('src/components/LandingPerfil.jsx', code);
console.log('Fixed icon url');

