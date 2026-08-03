const { Client } = require('pg');

async function test() {
  const client = new Client({
    host: '162.141.78.103',
    port: 5432,
    user: 'postgres.postgres',
    password: 'your-super-secret-and-long-postgres-password',
    database: 'postgres',
  });
  
  try {
    await client.connect();
    console.log("Connected to Postgres!");
    const res = await client.query('SELECT current_setting(\'server_version\')');
    console.log(res.rows);
    await client.end();
  } catch(e) {
    console.error("Failed:", e.message);
  }
}
test();
