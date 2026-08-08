const fs = require('fs');
const css = `
  .product-header-mobile {
    flex-direction: column !important;
    gap: 16px !important;
  }
  .product-header-info-mobile {
    flex-direction: row !important;
    width: 100% !important;
  }
  .product-actions-mobile {
    justify-content: flex-start !important;
    gap: 8px !important;
    width: 100% !important;
  }
  .product-actions-mobile > label {
    margin-right: 0 !important;
    width: 100% !important;
    justify-content: space-between !important;
  }
  .product-actions-mobile .btn {
    flex: 1;
    text-align: center;
    justify-content: center;
  }
`;
// We need to inject this inside the @media (max-width: 768px) block that we appended last time.
// Since we can't easily parse it, let's just append another @media (max-width: 768px) block at the end.
const fullCss = `\n@media (max-width: 768px) {\n${css}\n}\n`;
fs.appendFileSync('src/index.css', fullCss);
console.log('CSS appended.');
