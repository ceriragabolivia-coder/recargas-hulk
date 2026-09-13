const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres:postgres@162.141.78.103:5432/postgres' });
client.connect().then(() => {
  console.log('Connected to PG!');
  return client.query('SELECT NOW()');
}).then(res => {
  console.log(res.rows[0]);
  client.end();
}).catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
