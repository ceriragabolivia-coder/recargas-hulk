const fetch = require('node-fetch');

const API_KEY = 'fc_3e0467ab3d028115e317c2b1';

async function checkWebhook() {
  try {
    const res = await fetch('https://api.fzr.cards/api/v2/account/webhook', {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    console.log(`Status:`, res.status);
    const text = await res.text();
    console.log(`Response:`, text);
  } catch (err) {
    console.error(`Error:`, err.message);
  }
}

checkWebhook();
