const fetch = require('node-fetch');

const API_KEY = 'fc_3e0467ab3d028115e317c2b1';

async function reenableWebhook() {
  try {
    const res = await fetch('https://api.fzr.cards/api/v2/account/webhook', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: 'https://recargashulk.com/api/fazercards/webhook',
        enabled: true
      })
    });
    console.log(`Status:`, res.status);
    const text = await res.text();
    console.log(`Response:`, text);
  } catch (err) {
    console.error(`Error:`, err.message);
  }
}

reenableWebhook();
