// - The function only consumes tokens when the ElevenLabs request is made (i.e., when user clicks).
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import { API_BASE } from '../lib/config';

// Client-side TTS: call backend /chat/tts which proxies ElevenLabs.
// No local fallback to browser speech synthesis is performed by design.
// Usage: speakText('Bonjour', 'voiceId', optionalApiBase)

export async function speakText(
  text: string,
  voiceId = 'LEnmbrrxYsUYS7vsRRwD',
  apiBase?: string
): Promise<void> {
  if (!text) return;

  // Resolve API base priority:
  // 1) explicit apiBase arg
  // 2) global EXPO_API_URL (set by deploy or by developer)
  // 3) runtime detection: if running in a browser and hostname looks local -> use local dev server
  // 4) otherwise fall back to deployed Function URL
  const DEFAULT_DEPLOYED =
    'https://rtvfwmc7qd3p3shvzwb5pyliiy0fdvfo.lambda-url.ca-central-1.on.aws';

  const explicit = apiBase;
  // @ts-ignore - EXPO_API_URL may be injected at build time
  const globalUrl = (globalThis as any)?.EXPO_API_URL;

  const looksLikeLocalHost = (host: string) => {
    if (!host) return false;
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('192.168.') ||
      host.startsWith('172.16.') ||
      host.startsWith('10.')
    );
  };

  let resolvedBase = explicit || globalUrl || '';
  if (!resolvedBase) {
    if (typeof window !== 'undefined' && (window as any).location) {
      const host = (window as any).location.hostname || '';
      console.log(
        'looksLikeLocalHost check, host:',
        host,
        'result:',
        looksLikeLocalHost(host),
        'globalUrl:',
        globalUrl
      );
      resolvedBase = looksLikeLocalHost(host)
        // ? 'http://192.168.2.44:4000'
        ? API_BASE
        : DEFAULT_DEPLOYED;
    } else {
      // Native (Expo) or no window: prefer globalUrl if available, otherwise assume deployed
      resolvedBase = globalUrl || DEFAULT_DEPLOYED;
    }
  }

  const url = resolvedBase
    ? `${resolvedBase.replace(/\/$/, '')}/chat/tts`
    : '/chat/tts';

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, voiceId }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '[no body]');
    throw new Error(
      `TTS request failed ${resp.status}: ${String(txt).slice(0, 200)}`
    );
  }

  // Handler returns base64-encoded audio in the body (text, not binary).
  const b64 = await resp.text();
  const contentType = resp.headers.get('content-type') || '';

  // --- Credits / headers logging (non-blocking) ---
  try {
    // Per-request character cost (if forwarded verbatim from ElevenLabs)
    const charCost = Number(resp.headers.get('x-character-count') || '0');

    // These are computed + forwarded by your server from /v1/user/subscription
    const creditsRemaining = resp.headers.get('x-credits-remaining');
    const charLimit = resp.headers.get('x-character-limit');
    const charUsed = resp.headers.get('x-character-used');
    const resetUnix = resp.headers.get('x-credits-reset-unix');

    // Useful correlation ID from ElevenLabs (if forwarded)
    const requestId = resp.headers.get('request-id');

    // Dump all x-* headers for deep debugging
    const headerEntries: Array<[string, string]> = [];
    resp.headers.forEach((value, key) => {
      if (key.startsWith('x-')) headerEntries.push([key, value]);
    });
    const headersObj: Record<string, string> = Object.fromEntries(headerEntries);

    const summary: Record<string, any> = {
      source: 'elevenlabs',
      voiceId,
      textChars: text.length,
      charCost,
      requestId,
      creditsRemaining: creditsRemaining ? Number(creditsRemaining) : undefined,
      characterLimit: charLimit ? Number(charLimit) : undefined,
      characterUsed: charUsed ? Number(charUsed) : undefined,
      resetAt: resetUnix
        ? new Date(Number(resetUnix) * 1000).toISOString()
        : undefined,
      at: new Date().toISOString(),
    };

    console.log('[TTS Usage]', summary);
    if (Object.keys(headersObj).length) {
      console.debug('[TTS Headers]', headersObj);
    }
  } catch {
    // Non-blocking: ignore logging errors
  }
  // --- end credits logging ---

  // If server returned JSON (error object) or a non-audio content type, surface a clear error
  if (
    contentType.includes('application/json') ||
    (contentType.includes('text/plain') && b64.trim().startsWith('{'))
  ) {
    let parsed: any = null;
    try {
      parsed = JSON.parse(b64);
    } catch {
      /* ignore */
    }
    const msg =
      parsed?.error || parsed?.message || b64 || 'TTS returned non-audio response';
    throw new Error(`TTS server error: ${msg}`);
  }

  if (Platform.OS === 'web') {
    // Web: decode base64 to binary, create Blob and play via HTMLAudioElement
    let binary: Uint8Array;
    try {
      // atob may throw if input is not valid base64 (e.g., if server sent raw bytes)
      binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    } catch (e: any) {
      // Surface readable error instead of uncaught InvalidCharacterError
      throw new Error(
        `TTS decode failed: invalid base64 returned by server (${String(
          e?.message || e
        )})`
      );
    }

    const blob = new Blob([binary], { type: contentType || 'audio/mpeg' });
    const objectUrl = URL.createObjectURL(blob);
    const audio = new (globalThis as any).Audio(objectUrl);
    await audio.play();
    audio.addEventListener('ended', () => {
      URL.revokeObjectURL(objectUrl);
    });
  } else {
    // Native: use expo-av to play data URI
    const sound = new Audio.Sound();
    try {
      await sound.loadAsync({ uri: `data:audio/mpeg;base64,${b64}` });
      await sound.playAsync();
      // unload after playback
      sound.setOnPlaybackStatusUpdate((status) => {
        if ((status as any)?.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch (e) {
      // ensure we unload on error
      try {
        await sound.unloadAsync();
      } catch {
        /* ignore */
      }
      throw e;
    }
  }
}

export default { speakText };
