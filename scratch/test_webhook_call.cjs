const fetch = require('node-fetch');

async function sendDummyWebhook() {
  const payload = {
    event: "order.completed",
    data: {
      id: "ord-892879",
      status: "completed"
    }
  };

  const res = await fetch('https://recargashulk.com/api/fazercards/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response:', text);
}

sendDummyWebhook();
