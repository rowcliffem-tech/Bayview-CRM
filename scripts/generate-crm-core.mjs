import fs from 'node:fs';
const source=fs.readFileSync(new URL('../lib/crm-logic.mjs',import.meta.url),'utf8').replace(/^export /gm,'');
fs.writeFileSync(new URL('../public/crm-core.js',import.meta.url),'// Generated from lib/crm-logic.mjs.\n'+source);
