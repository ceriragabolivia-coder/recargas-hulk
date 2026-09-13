async function registerWebhook() {
  try {
    const res = await fetch('https://tiendagiftven.tech/api/v1/webhook', {
      method: 'POST',
      headers: {
        'X-API-Key': '20ed254a258178ac3c88568e27943fc9524b27d358ca62fb5be60b54eaf95240',
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
