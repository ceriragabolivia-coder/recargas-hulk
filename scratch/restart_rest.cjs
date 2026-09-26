const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('docker restart supabase-rest', (err, stream) => {
    stream.on('close', () => conn.end()).on('data', d => console.log(d.toString()));
  });
}).connect({ host: '162.141.78.103', port: 22, username: 'root', password: 'm+0JVjSbFo' });
