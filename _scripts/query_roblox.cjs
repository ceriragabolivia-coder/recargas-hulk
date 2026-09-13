require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.VITE_SUPABASE_DB_URL });
async function run() {
  await client.connect();
  let res = await client.query("SELECT trigger_name, action_statement FROM information_schema.triggers WHERE event_object_table = 'pedidos'");
  console.log("Triggers in pedidos:", res.rows);
  await client.end();
}
run().catch(console.error);
