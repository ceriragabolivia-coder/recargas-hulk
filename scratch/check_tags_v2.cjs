const fs = require('fs');
const content = fs.readFileSync('c:\\desarrollo\\excel\\app\\src\\components\\Checkout.jsx', 'utf8');
const lines = content.split('\n');

let stack = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Find all tags (simplified)
    const matches = line.match(/<(div|header|button|span|p|h1|h2|h3|img|input|style|<>|<\/div>|<\/header>|<\/button>|<\/span>|<\/p>|<\/h1>|<\/h2>|<\/h3>|<\/img>|<\/input>|<\/style>|<\/>)/g) || [];
    
    for (let tag of matches) {
        if (tag.startsWith('</')) {
            const closing = tag.replace('</', '').replace('>', '');
            if (stack.length > 0) {
                const top = stack.pop();
                if (top.tag !== closing) {
                    console.log(`Mismatch at line ${i + 1}: expected closing for ${top.tag} (opened at line ${top.line}), but found ${tag}`);
                }
            } else {
                console.log(`Unmatched closing tag ${tag} at line ${i + 1}`);
            }
        } else {
            const opening = tag.replace('<', '').replace('>', '');
            // Ignore self-closing tags if we can detect them easily
            if (!line.includes(`${tag}.../>`) && !['img', 'input', 'style'].includes(opening)) {
                stack.push({ tag: opening, line: i + 1 });
            }
        }
    }
}

console.log('Final stack:', stack);
