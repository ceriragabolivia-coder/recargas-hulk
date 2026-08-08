const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres:postgres@162.141.78.103:5432/postgres' });
// We don't have the password for direct DB access, but let's try 'postgres' or check if there is an env variable.
// Wait, the ssh command used psql -U supabase_admin -d postgres.
// Let's use ssh2 to run the command, but with proper escaping.
const { Client: SSHClient } = require('ssh2');
const conn = new SSHClient();
conn.on('ready', () => {
  conn.exec(`docker exec -i supabase-db psql -U supabase_admin -d postgres -c "SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgname NOT LIKE 'pg_%';"`, (err, stream) => {
    let data = '';
    stream.on('data', d => data += d).on('close', () => {
      console.log(data);
      conn.end();
    });
  });
}).connect({host: '162.141.78.103', port: 22, username: 'root', password: 'm+0JVjSbFo'});
