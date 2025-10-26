
// - The function only consumes tokens when the ElevenLabs request is made (i.e., when user clicks).
import { Platform } from 'react-native';
import { Audio } from 'expo-av';

// Client-side TTS: call backend /chat/tts which proxies ElevenLabs.
// No local fallback to browser speech synthesis is performed by design.
// Usage: speakText('Bonjour', 'voiceId', optionalApiBase)

export async function speakText(text: string, voiceId = 'LEnmbrrxYsUYS7vsRRwD', apiBase?: string): Promise<void> {
  if (!text) return;

  // Resolve API base priority:
  // 1) explicit apiBase arg
  // 2) global EXPO_API_URL (set by deploy or by developer)
  // 3) runtime detection: if running in a browser and hostname looks local -> use local dev server
  // 4) otherwise fall back to deployed Function URL
  const DEFAULT_DEPLOYED = 'https://rtvfwmc7qd3p3shvzwb5pyliiy0fdvfo.lambda-url.ca-central-1.on.aws';

  const explicit = apiBase;
  const globalUrl = (globalThis as any)?.EXPO_API_URL;

  const looksLikeLocalHost = (host: string) => {
    if (!host) return false;
    return host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.');
  };

  let resolvedBase = explicit || globalUrl || '';
  if (!resolvedBase) {
    if (typeof window !== 'undefined' && (window as any).location) {
      const host = (window as any).location.hostname || '';
      console.log('looksLikeLocalHost check, host:', host, 'result:', looksLikeLocalHost(host), 'globalUrl:', globalUrl);
      resolvedBase = looksLikeLocalHost(host) ? 'http://192.168.2.44:4000' : DEFAULT_DEPLOYED;
    } else {
      // Native (Expo) or no window: prefer globalUrl if available, otherwise assume deployed
      resolvedBase = globalUrl || DEFAULT_DEPLOYED;
    }
  }

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
  const contentType = resp.headers.get('content-type') || '';

  // If server returned JSON (error object) or a non-audio content type, surface a clear error
  if (contentType.includes('application/json') || contentType.includes('text/plain') && b64.trim().startsWith('{')) {
    let parsed: any = null;
    try { parsed = JSON.parse(b64); } catch (e) { /* ignore */ }
    const msg = parsed?.error || parsed?.message || b64 || 'TTS returned non-audio response';
    throw new Error(`TTS server error: ${msg}`);
  }

  if (Platform.OS === 'web') {
    // decode base64 to binary, create Blob and play via HTMLAudioElement
    let binary: Uint8Array;
    try {
      // atob may throw if input is not valid base64
      binary = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    } catch (e: any) {
      // Surface readable error instead of uncaught InvalidCharacterError
      throw new Error(`TTS decode failed: invalid base64 returned by server (${String(e?.message || e)})`);
    }
    const blob = new Blob([binary], { type: contentType || 'audio/mpeg' });
    const objectUrl = URL.createObjectURL(blob);
    const audio = new (globalThis as any).Audio(objectUrl);
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