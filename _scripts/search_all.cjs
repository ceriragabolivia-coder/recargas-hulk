const fs = require('fs');
const dir = 'supabase/migrations';
fs.readdirSync(dir).forEach(f => {
  if (!f.endsWith('.sql')) return;
  const c = fs.readFileSync(dir + '/' + f, 'utf8');
  if (c.includes('0.05')) {
    console.log(f);
  }
});
