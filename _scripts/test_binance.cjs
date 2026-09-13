require('dotenv').config();
import handler from './api-core/binance/verify-pay-pedido.js';
const req = {
  method: 'POST',
  body: {
    transferId: '453588204377899008',
    pedidoId: 2085,
    userId: 'fece8834-45fb-419b-ab29-e58fbeff9ce7', // Un userId cualquiera si no se valida fuertemente
    monto: '0.78'
  }
};
const res = {
  status: (s) => ({
    json: (data) => console.log('STATUS:', s, data)
  })
};
handler(req, res).catch(console.error);
