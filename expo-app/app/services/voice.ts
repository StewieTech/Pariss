
// - The function only consumes tokens when the ElevenLabs request is made (i.e., when user clicks).
import { Platform } from 'react-native';
import { Audio } from 'expo-av';

// Client-side TTS: call backend /chat/tts which proxies ElevenLabs.
// No local fallback to browser speech synthesis is performed by design.
// Usage: speakText('Bonjour', 'voiceId', optionalApiBase)

export async function speakText(text: string, voiceId = 'LEnmbrrxYsUYS7vsRRwD', apiBase?: string): Promise<void> {
  if (!text) return;

  // Resolve API base: prefer explicit arg, then global EXPO_API_URL, then empty (relative)
//   const resolvedBase = apiBase || (globalThis as any)?.EXPO_API_URL || '';
  const resolvedBase = 'http://192.168.2.44:4000';
  const url = resolvedBase ? `${resolvedBase.replace(/\/$/, '')}/chat/tts` : '/chat/tts';

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, voiceId }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '[no body]');
    throw new Error(`TTS request failed ${resp.status}: ${String(txt).slice(0,200)}`);
  }

  // Handler returns base64-encoded audio in the body
  const b64 = await resp.text();

  if (Platform.OS === 'web') {
    // decode base64 to binary, create Blob and play via HTMLAudioElement
    const binary = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const blob = new Blob([binary], { type: 'audio/mpeg' });
    const objectUrl = URL.createObjectURL(blob);
    const audio = new (window as any).Audio(objectUrl);
    await audio.play();
    audio.addEventListener('ended', () => { URL.revokeObjectURL(objectUrl); });
  } else {
    // Native: use expo-av to play data URI
    const sound = new Audio.Sound();
    try {
      await sound.loadAsync({ uri: `data:audio/mpeg;base64,${b64}` });
      await sound.playAsync();
      // unload after playback
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status?.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch (e) {
      // ensure we unload on error
      try { await sound.unloadAsync(); } catch (_) {}
      throw e;
    }
  }
}

export default { speakText };
