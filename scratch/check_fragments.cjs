const fs = require('fs');
const content = fs.readFileSync('c:\\desarrollo\\excel\\app\\src\\components\\Checkout.jsx', 'utf8');

// Count JSX fragments
const fragmentOpens = (content.match(/<>/g) || []).length;
const fragmentCloses = (content.match(/<\/>/g) || []).length;

console.log(`Fragment opens: ${fragmentOpens}, closes: ${fragmentCloses}`);

const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<>') || lines[i].includes('</>')) {
        const type = lines[i].includes('<>') ? 'OPEN' : 'CLOSE';
        console.log(`Line ${i+1} [${type}]: ${lines[i].trim()}`);
    }
}
