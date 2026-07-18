const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'index.html');
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.log('No GEMINI_API_KEY environment variable found. Leaving index.html unchanged.');
  process.exit(0);
}

try {
  let html = fs.readFileSync(filePath, 'utf8');
  
  if (html.includes('__GEMINI_API_KEY__')) {
    html = html.replace('__GEMINI_API_KEY__', apiKey);
    fs.writeFileSync(filePath, html, 'utf8');
    console.log('Successfully injected GEMINI_API_KEY into index.html.');
  } else {
    console.log('Placeholder __GEMINI_API_KEY__ not found in index.html (already replaced or modified).');
  }
} catch (error) {
  console.error('Error modifying index.html:', error);
  process.exit(1);
}
