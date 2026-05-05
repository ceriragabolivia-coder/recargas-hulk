const fs = require('fs');
const content = fs.readFileSync('c:\\desarrollo\\excel\\app\\src\\components\\Checkout.jsx', 'utf8');
const lines = content.split('\n');

let stack = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // This regex matches opening and closing div tags
    const matches = line.match(/<div|<\/div>/g) || [];
    
    for (let match of matches) {
        if (match === '<div') {
            stack.push(i + 1);
        } else {
            if (stack.length > 0) {
                stack.pop();
            } else {
                console.log(`EXTRA closing div at line ${i + 1}`);
            }
        }
    }
}

console.log('Unclosed divs started at lines:', stack);
