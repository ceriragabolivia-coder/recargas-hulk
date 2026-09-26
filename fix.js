import fs from 'fs';

let content = fs.readFileSync('src/index.css', 'utf8');

content = content.replace('.chat-main-window {', '.chat-main-window {\r\n  min-width: 0;');
content = content.replace('.message-image {', '.message-image {\r\n  max-width: 100%;\r\n  height: auto;');

fs.writeFileSync('src/index.css', content);
