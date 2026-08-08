const https = require('https');
https.get('https://api.fzr.cards/api/docs-json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log(Object.keys(parsed.paths).filter(p => p.toLowerCase().includes('telegram')).join('\n'));
    } catch(e) {
      console.log('Failed to parse:', e);
      console.log('Response was:', data.substring(0, 200));
    }
  });
}).on('error', err => console.log(err.message));
