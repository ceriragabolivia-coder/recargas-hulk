const { Client } = require('ssh2'); 
const conn = new Client(); 
conn.on('ready', () => { 
  conn.exec('docker exec -i supabase-db psql -U supabase_admin -d postgres -c "select (cast(\'{\\"pago_verificado\\\":null}\' as jsonb))->>\'pago_verificado\' is null as is_null, ((cast(\'{\\"pago_verificado\\\":null}\' as jsonb))->>\'pago_verificado\')::BOOLEAN as casted;"', (err, stream) => { 
    stream.on('data', d => console.log(''+d)).on('close', () => conn.end()); 
  }); 
}).connect({host: '162.141.78.103', port: 22, username: 'root', password: 'm+0JVjSbFo'});
