const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec('docker exec -i supabase-db psql -U postgres -d postgres', (err, stream) => {
    if (err) throw err;
    
    // Read the SQL file and pipe it to the stream
    const sqlContent = fs.readFileSync('supabase/migrations/237_rechazar_apk_expirados.sql', 'utf8');
    stream.write(sqlContent);
    stream.end();

    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      
      // Also execute NOTIFY pgrst, 'reload schema' just in case
      conn.exec('docker exec -i supabase-db psql -U postgres -d postgres -c "NOTIFY pgrst, \'reload schema\';"', (err2, stream2) => {
        if (err2) throw err2;
        stream2.on('close', () => conn.end());
      });
      
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '162.141.78.103',
  port: 22,
  username: 'root',
  password: 'm+0JVjSbFo',
  readyTimeout: 10000
});
