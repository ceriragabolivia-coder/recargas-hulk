const fs = require('fs');
let c = fs.readFileSync('src/components/GestionProductos.jsx', 'utf-8');

// Replace the bad DOM structure from lines 380 onwards. We know the unique parts.
const badPart = `       <div className="section-header" style={{ marginBottom: '16px' }}>`;
const fixedPart = `      <div className="content-grid" style={{ flex: 1, overflow: 'hidden' }}>
        {/* COLUMNA DE JUEGOS */}
        <div className="card juegos-column" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="section-header" style={{ marginBottom: '16px' }}>`;

c = c.replace(badPart, fixedPart);

// Fix the closing divs
c = c.replace(/          <\/div >\s*<div style={{ flex: 1, overflowY: 'auto' }}>/, `          </div>\n          <div style={{ flex: 1, overflowY: 'auto' }}>`);
c = c.replace(/    <\/div>\s*<\/div >\s*{\/\* LISTA DE PAQUETES\/PRODUCTOS \*\/ }/g, `          </div>\n        </div>\n\n        {/* LISTA DE PAQUETES/PRODUCTOS */}`);

// What about those spaces that were injected? Let's just strip them if they exist.
// 200+ spaces.
c = c.replace(/ {50,}/g, ' ');

fs.writeFileSync('src/components/GestionProductos.jsx', c);
console.log('Fixed');
