const { createWorker } = require('tesseract.js');
async function test() {
  const worker = await createWorker('eng');
  await worker.setParameters({ tessedit_pageseg_mode: '11' });
  const result = await worker.recognize('c:\\hulk\\app\\public\\assets\\bg-BDsJ3Vv3.png');
  console.log(result.data.words.map(w => ({ text: w.text, conf: w.confidence, length: w.text.length })).slice(0, 10));
  await worker.terminate();
}
test();
