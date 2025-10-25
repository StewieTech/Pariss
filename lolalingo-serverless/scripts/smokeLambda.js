// scripts/smoke.js
import axios from 'axios';
const base = process.env.FN_URL || 'https://rtvfwmc7qd3p3shvzwb5pyliiy0fdvfo.lambda-url.ca-central-1.on.aws';

async function test() {
  try {
    console.log('Health ->', (await axios.get(`${base}/health`)).data);
  } catch (e) { console.error('Health failed', e?.response?.data || e.message); }

  try {
    const r = await axios.post(`${base}/chat/translate`, { text: 'Hello, how are you?'});
    console.log('/chat/translate ->', r.status, r.data);
  } catch (e) { console.error('/chat/translate failed', e?.response?.status, e?.response?.data || e.message); }
}
test();