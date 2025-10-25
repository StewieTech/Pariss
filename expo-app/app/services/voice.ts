// Lightweight voice service for reading Lola's messages on demand.
// Behavior:
// - On browsers with the Web Speech API, uses speechSynthesis (no API key needed).
// - Otherwise, attempts to call ElevenLabs TTS endpoint for voice id `tempKeyReplace`.
// - The function only consumes tokens when the ElevenLabs request is made (i.e., when user clicks).

// Resolve configuration from several possible places:
// 1. process.env (Node/Jest/web-build-time)
// 2. Expo Constants manifest.extra (expo dev/runtime)
// 3. globalThis (manual injection in some test harnesses)
function resolveConfig() {
  let voiceId = (process && (process.env as any)?.ELEVEN_VOICE_ID) || (globalThis as any)?.ELEVEN_VOICE_ID || '';
  let apiKey = (process && (process.env as any)?.ELEVEN_API_KEY) || (globalThis as any)?.ELEVEN_API_KEY || '';
  try {
    // Try to read Expo Constants if available (expo-managed apps)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require('expo-constants');
    const extra = (Constants && (Constants.manifest && Constants.manifest.extra)) || (Constants && Constants.expoConfig && Constants.expoConfig.extra);
    if (extra) {
      voiceId = voiceId || extra.ELEVEN_VOICE_ID || '';
      apiKey = apiKey || extra.ELEVEN_API_KEY || '';
    }
  } catch (e) {
    // not running in expo - ignore
  }
  return { voiceId, apiKey };
}

export async function speakText(text: string): Promise<void> {
  if (!text) return;


  // Resolve dynamic config at call-time
  const { voiceId: ELEVEN_VOICE_ID, apiKey: ELEVEN_API_KEY } = resolveConfig();

  // If no ElevenLabs key is configured and Web Speech API isn't available, bail with a helpful message.
  if (!ELEVEN_API_KEY && !(typeof globalThis !== 'undefined' && (globalThis as any).speechSynthesis)) {
    console.warn('No ElevenLabs API key configured (ELEVEN_API_KEY). Cannot synthesize voice.');
    return;
  }

  try {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}/stream`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVEN_API_KEY,
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
