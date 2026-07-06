import fetch from 'node-fetch';

async function testWebhook() {
  const url = 'https://recargashulk.com/api/pagos/webhook';
  
  const payload = {
    referencia: "701284", // Reference from the screenshot 99
    monto: 739
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer BdvSecret_Hulk_2026!',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Body:", text);
}

testWebhook();
