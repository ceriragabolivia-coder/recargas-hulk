const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'Layout.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Use a more flexible regex for duplicates
// This matches the second occurrence which is usually near the counts state
const hookPattern = /const\s+{\s*user,\s*perfil,\s*logout\s*}\s*=\s*useAuth\(\)\s*\n\s*const\s+{\s*config\s*}\s*=\s*useConfiguracion\(\)/g;

let matches = [...content.matchAll(hookPattern)];
if (matches.length > 1) {
    // Keep the first one, remove the subsequent ones
    // We'll just remove the one after the counts state
    console.log(`Found ${matches.length} hook declarations. Removing duplicates...`);
    
    // Simplest way: just replace the specific one we know is wrong
    content = content.replace(hookPattern, (match, offset) => {
        // If it's the first match, keep it. But wait, we already added sound logic to the first one!
        // So the first one doesn't match this pattern anymore.
        // Therefore, any match of this pattern is a duplicate.
        return "";
    });
}

fs.writeFileSync(filePath, content);
console.log("Layout.jsx duplicates cleaned.");
