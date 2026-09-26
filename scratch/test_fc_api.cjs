const fetch = require('node-fetch');

const API_KEY = 'fc_3e0467ab3d028115e317c2b1';

async function checkOrder(id) {
  try {
    const res = await fetch(`https://api.fzr.cards/api/v2/orders/${id}`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    console.log(`\nStatus for ${id}:`, res.status);
    const text = await res.text();
    console.log(`Response for ${id}:`, text.substring(0, 200));
  } catch (err) {
    console.error(`Error for ${id}:`, err.message);
  }
}

async function run() {
  await checkOrder('819184');
  await checkOrder('ord-819184');
}

run();
