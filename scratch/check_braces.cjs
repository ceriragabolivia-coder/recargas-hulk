const fs = require('fs');
const content = fs.readFileSync('c:\\desarrollo\\excel\\app\\src\\components\\Checkout.jsx', 'utf8');

function countBraces(str) {
    let open = 0;
    let close = 0;
    for (let char of str) {
        if (char === '{') open++;
        if (char === '}') close++;
    }
    return { open, close };
}

console.log('Braces:', countBraces(content));

// Count opening and closing tags in JSX returns
function countJSX(str) {
    let openDiv = (str.match(/<div/g) || []).length;
    let closeDiv = (str.match(/<\/div>/g) || []).length;
    return { openDiv, closeDiv };
}

console.log('JSX divs:', countJSX(content));
