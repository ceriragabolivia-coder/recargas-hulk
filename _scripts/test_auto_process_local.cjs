const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) process.env[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
});

const autoProcess = require('./api/pedidos/auto_process.js').default;

const req = {
  method: 'POST',
  body: { pedido_id: 107, force: true }
};

const res = {
  status: (code) => {
    console.log('STATUS:', code);
    return {
      json: (data) => console.log('JSON:', data)
    };
  }
};

autoProcess(req, res).catch(console.error);
