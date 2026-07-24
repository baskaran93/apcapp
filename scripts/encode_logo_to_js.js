const fs = require('fs');
const path = require('path');

const logoPath = path.join(__dirname, '..', 'assets', 'images', 'logo.png');
const outPath = path.join(__dirname, '..', 'src', 'constants', 'logo_base64.js');

if (!fs.existsSync(logoPath)) {
  console.error('Logo file not found:', logoPath);
  process.exit(1);
}

const data = fs.readFileSync(logoPath);
const base64 = data.toString('base64');
const content = `// Auto-generated. Do not edit manually.\nexport default 'data:image/png;base64,${base64}';\n`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, content);
console.log('Wrote', outPath);
