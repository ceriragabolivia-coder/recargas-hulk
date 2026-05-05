const fs = require('fs');
const content = fs.readFileSync('c:\\desarrollo\\excel\\app\\src\\components\\Checkout.jsx', 'utf8');
const lines = content.split('\n');

let stack = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Track <> and </> fragments
    const fragmentOpens = (line.match(/(?<![a-zA-Z])<>/g) || []).length;
    const fragmentCloses = (line.match(/<\/>/g) || []).length;
    
    for (let j = 0; j < fragmentOpens; j++) {
        stack.push({ type: 'fragment', line: i + 1 });
    }
    for (let j = 0; j < fragmentCloses; j++) {
        if (stack.length > 0 && stack[stack.length-1].type === 'fragment') {
            stack.pop();
        } else {
            console.log(`LINE ${i+1}: Unmatched fragment close`);
        }
    }
}

console.log('Unclosed fragments:', stack);
