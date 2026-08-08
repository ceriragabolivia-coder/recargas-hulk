const fetch = require('node-fetch');

const API_KEY = 'fc_3e0467ab3d028115e317c2b1';
const WEBHOOK_URL = 'https://recargashulk.com/api/fazercards/webhook';

async function registerWebhook() {
  try {
    const res = await fetch('https://api.fzr.cards/api/v2/account/webhook', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        enabled: true
      })
    });

    const data = await res.json();
    if (res.ok) {
      console.log('✅ Webhook configurado exitosamente:', data);
    } else {
      console.error('❌ Error configurando webhook:', data);
    }
  } catch (err) {
    console.error('❌ Excepción de red:', err);
  }
}

registerWebhook();
