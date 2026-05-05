const fs = require('fs');
const content = fs.readFileSync('c:\\desarrollo\\excel\\app\\src\\components\\Checkout.jsx', 'utf8');
const lines = content.split('\n');

let stack = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matches = line.match(/<div|<\/div>/g) || [];
    
    for (let match of matches) {
        if (match === '<div') {
            stack.push(i + 1);
        } else {
            if (stack.length > 0) {
                stack.pop();
            } else {
                console.log(`LINE ${i + 1}: Unmatched close`);
            }
        }
    }
    // console.log(`LINE ${i + 1}: Stack size ${stack.length}`);
}

console.log('Final unclosed lines:', stack);
