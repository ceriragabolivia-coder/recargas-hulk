const https = require('https');

const token = '7950382410:AAEJj-t-s8mPfYd6zMRz823lYBGZ0B1xjcU';
const chatId = '-1003732979887';
const message = '🚀 ¡Bot de Telegram conectado y funcionando!';

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
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Response:', body);
  });
});

req.on('error', (e) => console.error(e));
req.write(data);
req.end();
