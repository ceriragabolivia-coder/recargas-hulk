const apiKey = 'fzrc_live_0b0ef8540b79e782672522e4';

async function run() {
  let res = await fetch(`https://api.fzr.cards/api/v2/giftcards/order`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category_id: 'roblox_robux_us',
      card_id: '500_robux',
      quantity: 1
    })
  });
  console.log("POST GIFTCARDS:", await res.text());
}
run();
