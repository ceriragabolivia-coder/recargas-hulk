const fs = require('fs');
const css = `
/* MOBILE OPTIMIZATIONS FOR GESTION PRODUCTOS */
.juegos-column {
  width: 280px;
}
@media (max-width: 768px) {
  .gestion-productos-grid {
    flex-direction: column !important;
    padding: 12px !important;
    gap: 12px !important;
  }
  .juegos-column {
    width: 100% !important;
    max-height: auto !important;
    flex: none !important;
  }
  .juegos-column .juegos-list-container {
    display: flex !important;
    flex-direction: row !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    white-space: nowrap !important;
    padding-bottom: 8px !important;
    border-bottom: 1px solid var(--border-color);
    align-items: center;
  }
  .juegos-column .nav-item {
    display: inline-block !important;
    border-bottom: none !important;
    border-radius: 12px !important;
    padding: 8px 16px !important;
    margin: 0 8px 0 0 !important;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.05);
  }
  .juegos-column .nav-item.active {
    background: var(--primary-color) !important;
    color: #fff !important;
    font-weight: bold;
  }
  .product-list-card {
    flex: 1 !important;
    margin-top: 0 !important;
  }
}
`;
fs.appendFileSync('src/index.css', css);
console.log('CSS appended.');
