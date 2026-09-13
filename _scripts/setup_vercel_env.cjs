const { execSync } = require('child_process');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const lines = envContent.split('\n');

let supabaseUrl = '';
let supabaseAnon = '';

lines.forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseAnon = line.split('=')[1].trim();
});

console.log('Removing old Vercel envs...');
try { execSync('npx vercel env rm VITE_SUPABASE_URL production -y'); } catch(e) {}
try { execSync('npx vercel env rm VITE_SUPABASE_ANON_KEY production -y'); } catch(e) {}

console.log('Adding new Vercel envs...');
execSync(echo  | npx vercel env add VITE_SUPABASE_URL production);
execSync(echo  | npx vercel env add VITE_SUPABASE_ANON_KEY production);

console.log('Done.');
