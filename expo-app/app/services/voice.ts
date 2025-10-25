
// - The function only consumes tokens when the ElevenLabs request is made (i.e., when user clicks).
try { require('dotenv').config(); } catch (e) {}



//   const voiceId = process.env.ELEVEN_VOICE_ID;
  const voiceId = 'LEnmbrrxYsUYS7vsRRwD';
const apiKey = process.env.ELEVEN_API_KEY;
console.log('voiceIdd and apiKey', { voiceId, apiKey });



export async function speakText(text: string): Promise<void> {
  if (!text) return;


if (!voiceId || !apiKey) {
  console.error('Missing ELEVEN_VOICE_ID or ELEVEN_API_KEY in environment. Check .env or process.env.');
  console.error('ELEVEN_VOICE_ID=', !!voiceId, 'ELEVEN_API_KEY=', !!apiKey);
  process.exit(2);
}


  try {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({ text }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '[no body]');
      console.warn('ElevenLabs TTS failed', resp.status, txt);
      return;
    }

    const blob = await resp.blob();
    const objUrl = URL.createObjectURL(blob);
    // Create an audio element and play
    const audio = new Audio(objUrl);
    await audio.play();
    // Revoke URL after playback (best-effort)
    audio.addEventListener('ended', () => { URL.revokeObjectURL(objUrl); });
  } catch (e) {
    console.error('speakText error', e);
  }
}

export default { speakText };
