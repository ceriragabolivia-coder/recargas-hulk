const fs = require('fs');
const content = fs.readFileSync('c:\\desarrollo\\excel\\app\\src\\components\\Checkout.jsx', 'utf8');
const lines = content.split('\n');

let stack = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matches = line.match(/<div|<\/div>/g) || [];
    
    for (let match of matches) {
        if (match === '<div') {
            stack.push({ line: i + 1, content: line.trim() });
        } else {
            if (stack.length > 0) {
                const open = stack.pop();
                // Optional: print matches for deep debugging
                // console.log(`Matched ${open.line} with ${i + 1}`);
            } else {
                console.log(`EXTRA closing div at line ${i + 1}`);
            }
        }
    }
}

console.log('Unclosed divs:');
stack.forEach(s => console.log(`Line ${s.line}: ${s.content}`));
