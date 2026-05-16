const https = require('https');

const token = '7950382410:AAEJj-t-s8mPfYd6zMRz823IYBGZ0B1xjcU';
const chatId = '-1003732979887';
const message = '🤖 Prueba de conexión desde el servidor de desarrollo.';

const data = JSON.stringify({
  chat_id: chatId,
  text: message,
  parse_mode: 'HTML'
});

const options = {
  hostname: 'api.telegram.org',
  port: 443,
  path: `/bot${token}/sendMessage`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Response:', body);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();
