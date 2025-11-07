#!/usr/bin/env node
// Simple smoke test to verify ELEVEN_API_KEY and ELEVEN_VOICE_ID reach ElevenLabs
// Usage: node ./scripts/smoketest.js or npm run smoke
// cd 'c:\Users\Errol\Dropbox\Harvard CS50\StewieTech Portfolio\Backend\LolaInParis\expo-app' ; node ./scripts/ElevenSmokeTest.js --text "Bonjour, ceci est un test" --out ./scripts/test-output.mp3
try { require('dotenv').config(); } catch (e) {}

const voiceId = process.env.ELEVEN_VOICE_ID;
const apiKey = process.env.ELEVEN_API_KEY;

if (!voiceId || !apiKey) {
  console.error('Missing ELEVEN_VOICE_ID or ELEVEN_API_KEY in environment. Check .env or process.env.');
  console.error('ELEVEN_VOICE_ID=', !!voiceId, 'ELEVEN_API_KEY=', !!apiKey);
  process.exit(2);
}

async function run() {
  const fetchFn = (typeof global !== 'undefined' && global.fetch) ? global.fetch : (() => {
    try { return require('node-fetch'); } catch (e) { return null; }
  })();
  if (!fetchFn) {
    console.error('No fetch available. Please run with Node >=18 or install node-fetch.');
    process.exit(3);
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;
  console.log('Calling ElevenLabs TTS endpoint (HEAD) to validate credentials...');
  try {
    const resp = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      // small test text
      body: JSON.stringify({ text: 'Smoke test - please ignore' }),
    });

    console.log('Response status:', resp.status);
    if (resp.status === 401 || resp.status === 403) {
      const body = await resp.text().catch(() => '[binary]');
      console.error('Auth failed. Response body:', body);
      process.exit(1);
    }

    if (!resp.ok) {
      const body = await resp.text().catch(() => '[binary]');
      console.error('ElevenLabs returned non-ok status:', resp.status, body.slice ? body.slice(0, 200) : body);
      process.exit(1);
    }

    // Success: show content-type and exit
    console.log('Success. Content-Type:', resp.headers.get('content-type'));
    process.exit(0);
  } catch (err) {
    console.error('Request failed:', err);
    process.exit(1);
  }
}

run();
