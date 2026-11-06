const { writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { readPublicConfig } = require('../public-config.cjs');
const config = readPublicConfig(process.env);
// Only the project URL and public key are serialized. Never serialize process.env.
const json = JSON.stringify(config).replace(/</g, '\\u003c');
writeFileSync(resolve(__dirname, '../public-config.js'), `window.SYNTHEX_PUBLIC_CONFIG = ${json};\n`, 'utf8');
console.log('Generated public Supabase configuration.');
