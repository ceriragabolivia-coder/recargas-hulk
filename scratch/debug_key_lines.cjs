const fs = require('fs');
const content = fs.readFileSync('c:\\desarrollo\\excel\\app\\src\\components\\Checkout.jsx', 'utf8');
const lines = content.split('\n');

let stack = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matches = line.match(/<div|<\/div>/g) || [];
    
    for (let match of matches) {
        if (match === '<div') {
            stack.push({ line: i + 1, tag: 'div' });
        } else {
            if (stack.length > 0) {
                stack.pop();
            } else {
                console.log(`LINE ${i + 1}: Unmatched close`);
            }
        }
    }
    if (i + 1 >= 508 && i + 1 <= 515) {
        console.log(`After LINE ${i + 1} Stack:`, stack.map(s => s.line).join(','));
    }
    if (i + 1 === 871 || i + 1 === 872 || i + 1 === 873) {
        console.log(`After LINE ${i + 1} Stack:`, stack.map(s => s.line).join(','));
    }
}
console.log('Final:', stack.map(s => s.line).join(','));
