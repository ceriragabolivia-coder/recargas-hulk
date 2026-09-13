require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.VITE_SUPABASE_DB_URL });
async function run() {
  await client.connect();
  let res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'productos'");
  console.log("Columnas productos:", res.rows);
  await client.end();
}
run().catch(console.error);
