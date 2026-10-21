await import('./generate-shell.mjs');
await import('./generate-crm-core.mjs');
await import('./generate-mobile.mjs');
process.argv=[process.execPath,new URL('./run-framework.mjs',import.meta.url).pathname,'build'];
await import('./run-framework.mjs');
