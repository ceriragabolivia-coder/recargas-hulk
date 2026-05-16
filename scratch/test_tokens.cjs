const https = require('https');

const chatId = '-1003732979887';

async function testToken(token) {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      chat_id: chatId,
      text: `🤖 Test with token ${token}`,
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
        resolve({ token, body });
      });
    });

    req.on('error', (error) => {
      resolve({ token, error });
    });

    req.write(data);
    req.end();
  });
}

async function run() {
  const tokens = [
    '7950382410:AAEJj-t-s8mPfYd6zMRz823lYBGZ0B1xjcU', // lowercase L
    '7950382410:AAEJj-t-s8mPfYd6zMRz823IYBGZ0B1xjcU', // uppercase I
    '7950382410:AAEJj-t-s8mPfYd6zMRz8231YBGZ0B1xjcU'  // number 1
  ];

  for (const t of tokens) {
    const res = await testToken(t);
    console.log(`Token: ${t} -> Response: ${res.body || res.error}`);
  }
}

run();
