import fs from 'node:fs';
const html=fs.readFileSync(new URL('../ui/index.html',import.meta.url),'utf8');
fs.writeFileSync(new URL('../ui/template.ts',import.meta.url),'// Generated from ui/index.html by scripts/generate-shell.mjs.\nexport const html = '+JSON.stringify(html)+';\n');
