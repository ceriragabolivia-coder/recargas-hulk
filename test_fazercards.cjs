const apiKey = 'fzrc_live_0b0ef8540b79e782672522e4';

async function run() {
  let res = await fetch(`https://api.fzr.cards/api/v2/giftcards/cards?category_id=roblox_robux_us`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  console.log("GIFTCARDS CARDS:", await res.text());
}
run();
