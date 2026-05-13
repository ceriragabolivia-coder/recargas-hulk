const { createClient } = require('@supabase/supabase-client');
require('dotenv').config({ path: 'c:/desarrollo/excel/app/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const { data, error } = await supabase.from('juegos').select('*').limit(1);
  if (error) {
    console.error('Error fetching juegos:', error);
    return;
  }
  if (data && data.length > 0) {
    console.log('Columns in juegos:', Object.keys(data[0]));
  } else {
    console.log('No data in juegos table to check columns.');
  }
}

checkColumns();
