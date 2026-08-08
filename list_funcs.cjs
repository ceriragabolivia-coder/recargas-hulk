const fs = require('fs');
const dir = 'supabase/migrations';
const functions = new Set();
fs.readdirSync(dir).forEach(f => {
  if (!f.endsWith('.sql')) return;
  const c = fs.readFileSync(dir + '/' + f, 'utf8');
  const matches = c.match(/CREATE OR REPLACE FUNCTION\s+([a-zA-Z0-9_]+)/gi);
  if (matches) {
    matches.forEach(m => functions.add(m));
  }
});
console.log(Array.from(functions).join('\n'));
