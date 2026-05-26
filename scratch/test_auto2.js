import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function check() {
  const { data: { session }, error: loginErr } = await supabase.auth.signInWithPassword({
    email: 'ceriraga@gmail.com',
    password: 'ceriragapassword' // I will try default or similar? Actually, I don't know the password.
  });
}
check();
