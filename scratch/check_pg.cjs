const { Client } = require('pg');
const client = new Client({ 
  host: '162.141.78.103',
  port: 5432,
  user: 'supabase_admin',
  password: 'm+0JVjSbFo',
  database: 'postgres'
});
client.connect().then(() => {
  console.log("Connected to PostgreSQL successfully");
  client.end();
}).catch(err => {
  console.error("Failed to connect:", err);
});
