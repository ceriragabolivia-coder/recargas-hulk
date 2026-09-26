async function registerWebhook() {
  try {
    const res = await fetch('https://tiendagiftven.tech/api/v1/webhook', {
      method: 'POST',
      headers: {
        'X-API-Key': process.env.TIENDAGIFTVEN_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: 'https://recargashulk.com/api/tiendagiftven/webhook' })
    });
    const data = await res.json();
    console.log("Response:", data);
  } catch (e) {
    console.error(e);
  }
}
registerWebhook();
