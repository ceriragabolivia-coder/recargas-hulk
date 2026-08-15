const { createWorker } = require('tesseract.js');

(async () => {
  try {
    const worker = await createWorker('eng');
    await worker.setParameters({
      tessedit_pageseg_mode: '11',
    });
    console.log("Success setting parameter!");
    process.exit(0);
  } catch (err) {
    console.error("Error setting parameter:", err);
    process.exit(1);
  }
})();
