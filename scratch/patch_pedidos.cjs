const fs = require('fs');
const file = 'c:/desarrollo/excel/app/src/components/Pedidos.jsx';
let code = fs.readFileSync(file, 'utf8');

const target = `      const updates = cambiarEstado 
        ? { estado: 'reembolsado', reembolso_billetera: true, updated_at: new Date().toISOString() }
        : { reembolso_billetera: true, updated_at: new Date().toISOString() };`;

const replacement = `      const updates = cambiarEstado 
        ? { 
            estado: 'reembolsado', 
            reembolso_billetera: true, 
            updated_at: new Date().toISOString(),
            pedido_items: pedido.pedido_items?.map(item => ({ ...item, codigo_entregado: null }))
          }
        : { reembolso_billetera: true, updated_at: new Date().toISOString() };`;

code = code.replace(target, replacement);
fs.writeFileSync(file, code);
