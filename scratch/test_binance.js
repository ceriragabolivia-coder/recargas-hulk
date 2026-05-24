import crypto from 'crypto';

async function testBinance() {
  const apiKey = '3vrxRc362qhDdELzNnyDUOj0JGUbij1NFXbNIE3ufGNC7SzBzzDbesba7uWB3Rvn';
  const secretKey = 'spzso8yHDYJgJY4BmCj5ed8MJNrsVlrJGbdfB9YlmGhwMrgexrcMvEFzyFLw96JH';

  const requestBody = {
    env: { terminalType: 'WEB' },
    merchantTradeNo: 'TEST_' + Date.now(),
    orderAmount: '1.03',
    currency: 'USDT', 
    goods: {
      goodsType: '02',
      goodsCategory: 'Z000',
      referenceGoodsId: '123',
      goodsName: 'Test',
      goodsDetail: 'Test details'
    }
  };

  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const bodyStr = JSON.stringify(requestBody);
  
  const payload = `${timestamp}\n${nonce}\n${bodyStr}\n`;
  const signature = crypto
    .createHmac('sha512', secretKey)
    .update(payload)
    .digest('hex')
    .toUpperCase();

  const binanceRes = await fetch('https://bpay.binanceapi.com/binancepay/openapi/v2/order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'BinancePay-Timestamp': timestamp,
      'BinancePay-Nonce': nonce,
      'BinancePay-Certificate-SN': apiKey,
      'BinancePay-Signature': signature
    },
    body: bodyStr
  });

  const data = await binanceRes.json();
  console.log(JSON.stringify(data, null, 2));
}

testBinance();
