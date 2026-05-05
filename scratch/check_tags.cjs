const fs = require('fs');
const content = fs.readFileSync('c:\\desarrollo\\excel\\app\\src\\components\\Checkout.jsx', 'utf8');
const lines = content.split('\n');

let stack = [];
let missing = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const openMatches = line.match(/<div/g) || [];
    const closeMatches = line.match(/<\/div>/g) || [];
    
    for (let j = 0; j < openMatches.length; j++) {
        stack.push(i + 1);
    }
    for (let j = 0; j < closeMatches.length; j++) {
        if (stack.length > 0) {
            stack.pop();
        } else {
            console.log(`Unmatched closing div at line ${i + 1}`);
        }
    }
}

console.log('Unclosed divs started at lines:', stack);
