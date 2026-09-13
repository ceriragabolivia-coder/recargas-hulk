const fs = require('fs');
const dir = 'supabase/migrations';
fs.readdirSync(dir).forEach(f => {
  if (!f.endsWith('.sql')) return;
  const c = fs.readFileSync(dir + '/' + f, 'utf8');
  if (c.includes('esperaba') || c.includes('pago_verificado = true') || c.includes('pago_verificado = false') || c.includes('auto_aprobar_pedido')) {
    console.log(f);
  }
});
