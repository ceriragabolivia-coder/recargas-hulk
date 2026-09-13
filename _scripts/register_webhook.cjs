const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(`docker exec -i supabase-db psql -U postgres -d postgres -t -c "SELECT valor_texto FROM configuracion WHERE clave='tiendagiftven_api_key';"`, (err, stream) => {
    if (err) throw err;
    let result = '';
    stream.on('close', (code, signal) => {
      conn.end();
      const apiKey = result.trim();
      if (!apiKey) {
        console.log("No API key found");
        return;
      }
      console.log("Found API Key:", apiKey.substring(0, 10) + '...');
      
      // Register webhook
      fetch('https://tiendagiftven.tech/api/v1/webhook', {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: "https://recargashulk.com/api/tiendagiftven/webhook" })
      })
      .then(r => r.json())
      .then(data => console.log("Webhook registration result:", data))
      .catch(e => console.error("Error registering webhook:", e));

    }).on('data', (data) => {
      result += data.toString();
    });
  });
}).connect({
  host: '162.141.78.103',
  port: 22,
  username: 'root',
  password: 'm+0JVjSbFo'
});
