import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// small helper to require ESM-built dist file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  // ensure handler is built
  const handlerPath = path.join(__dirname, 'dist', 'handler.js');
  const fs = await import('fs');
  if (!fs.existsSync(handlerPath)) {
    console.error('Please run: npm run build');
    process.exit(1);
  }

  // Prefer the CommonJS build for local testing
  const cjsPath = path.join(__dirname, 'dist', 'handler.cjs');
  let http;
  if (fs.existsSync(cjsPath)) {
    // load CommonJS bundle from ESM using createRequire
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const mod = require(cjsPath);
    http = mod.http || mod.exports?.http;
  } else {
    // fallback to ESM build
    const handlerUrl = new URL('file://' + handlerPath);
    const mod = await import(handlerUrl.href);
    http = mod.http;
  }

  // set OPENAI key locally to bypass SSM for testing
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-local-000000000000000000000000';
  process.env.ENV_ALIAS = process.env.ENV_ALIAS || 'staging';

  const event = {
    requestContext: { http: { method: 'POST', path: '/chat/send' } },
    body: JSON.stringify({ text: 'hello from local test', mode: 'm1', userId: 'local' })
  };

  try {
    const res = await http(event, {});
    console.log('HANDLER RESPONSE:\n', res);
  } catch (err) {
    console.error('HANDLER THREW:', err);
  }
}

run();
