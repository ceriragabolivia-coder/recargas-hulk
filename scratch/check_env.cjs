const { Client } = require('pg');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) env[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
});

// We need a postgres connection string. Supabase URL is like https://xyz.supabase.co
// We don't have the direct postgres string, maybe it's in .env?
console.log(Object.keys(env).filter(k => k.toLowerCase().includes('post') || k.toLowerCase().includes('db') || k.toLowerCase().includes('sql')));
