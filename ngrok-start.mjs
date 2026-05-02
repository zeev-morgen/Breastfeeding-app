#!/usr/bin/env node
/**
 * Starts an ngrok tunnel to the backend and updates mobile/app.json automatically.
 * Usage:
 *   NGROK_AUTHTOKEN=<your_token> node ngrok-start.mjs [port]
 *   node ngrok-start.mjs [port]   # if token already saved via `ngrok config add-authtoken`
 *
 * Default port: 5000 (matches backend .env PORT)
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// Support both local install and global install under /opt/node22
const ngrok = (() => {
  try { return require('@ngrok/ngrok'); } catch {
    return require('/opt/node22/lib/node_modules/@ngrok/ngrok');
  }
})();
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_JSON = resolve(__dirname, 'mobile/app.json');
const portArg = process.argv[2];
if (portArg === '--help' || portArg === '-h') {
  console.log('Usage: NGROK_AUTHTOKEN=<token> node ngrok-start.mjs [port]');
  console.log('Default port: 5000');
  process.exit(0);
}
const PORT = parseInt(portArg ?? process.env.PORT ?? '5000', 10) || 5000;
const AUTHTOKEN = process.env.NGROK_AUTHTOKEN;

if (!AUTHTOKEN) {
  console.warn('⚠️  NGROK_AUTHTOKEN not set — ngrok will use your saved config (~/.ngrok2/ngrok.yml).');
  console.warn('   To set it: export NGROK_AUTHTOKEN=your_token_here\n');
}

console.log(`🚇  Opening ngrok tunnel → localhost:${PORT} …`);

const listener = await ngrok.forward({
  addr: PORT,
  ...(AUTHTOKEN ? { authtoken: AUTHTOKEN } : {}),
});

const url = listener.url();
console.log(`✅  Tunnel URL: ${url}`);

// Patch mobile/app.json
const appJson = JSON.parse(readFileSync(APP_JSON, 'utf8'));
const prev = appJson.expo.extra.apiBaseUrl;
appJson.expo.extra.apiBaseUrl = url;
writeFileSync(APP_JSON, JSON.stringify(appJson, null, 2) + '\n');
console.log(`📱  app.json updated: ${prev} → ${url}`);
console.log('\nPress Ctrl+C to stop.\n');

process.on('SIGINT', async () => {
  console.log('\n🛑  Closing tunnel…');
  await listener.close();
  // restore original URL
  appJson.expo.extra.apiBaseUrl = prev;
  writeFileSync(APP_JSON, JSON.stringify(appJson, null, 2) + '\n');
  console.log(`📱  app.json restored to ${prev}`);
  process.exit(0);
});

// Keep alive
await new Promise(() => {});
