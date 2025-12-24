// voice.ts

import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import { API_BASE } from '../lib/config'; // adjust path if needed

type VoiceCacheEntry = {
  b64: string;
  contentType: string;
};

const voiceCache = new Map<string, VoiceCacheEntry>();

// Client-side TTS: call backend /chat/tts which proxies ElevenLabs.
// Usage: await speakText('Bonjour', 'voiceId', optionalApiBase);
// Promise resolves only when playback finishes.
export async function speakText(
  text: string,
  voiceId = 'LEnmbrrxYsUYS7vsRRwD',
  apiBase?: string
): Promise<void> {
  if (!text) return;

  const cacheKey = `${voiceId}::${text}`;
  let cached = voiceCache.get(cacheKey);

  // Resolve API base:
  // 1) explicit arg
  // 2) centralized API_BASE from config.ts
  let resolvedBase = apiBase || API_BASE;
  if (!resolvedBase) {
    if (typeof window !== 'undefined' && (window as any).location) {
      const host = (window as any).location.hostname || '';
      console.log('TTS fallback base resolution, host:', host);
      resolvedBase = window.location.origin;
    } else {
      throw new Error('No API base URL configured for TTS');
    }
  }
  const url = `${resolvedBase.replace(/\/$/, '')}/chat/tts`;

  // If no cache -> fetch, log usage, cache
  if (!cached) {
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

    const b64 = await resp.text();
    const contentType = resp.headers.get('content-type') || 'audio/mpeg';

    // --- Credits / headers logging (only when we actually call TTS) ---
    try {
      const charCost = Number(resp.headers.get('x-character-count') || '0');
      const creditsRemaining = resp.headers.get('x-credits-remaining');
      const charLimit = resp.headers.get('x-character-limit');
      const charUsed = resp.headers.get('x-character-used');
      const resetUnix = resp.headers.get('x-credits-reset-unix');
      const requestId = resp.headers.get('request-id');

      const headerEntries: Array<[string, string]> = [];
      resp.headers.forEach((value, key) => {
        if (key.startsWith('x-')) headerEntries.push([key, value]);
      });
      const headersObj: Record<string, string> =
        Object.fromEntries(headerEntries);

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
      // ignore logging errors
    }
    // --- end credits logging ---

    // If server returned JSON/error instead of audio, surface that
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
        parsed?.error ||
        parsed?.message ||
        b64 ||
        'TTS returned non-audio response';
      throw new Error(`TTS server error: ${msg}`);
    }

    cached = { b64, contentType };
    voiceCache.set(cacheKey, cached);
  }

  const { b64, contentType } = cached;

  // --- Playback; this Promise resolves when playback finishes ---

  if (Platform.OS === 'web') {
    // Web: decode base64 to binary, create Blob and play via HTMLAudioElement,
    // resolving only when playback ends.
    let binary: Uint8Array;
    try {
      binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    } catch (e: any) {
      throw new Error(
        `TTS decode failed: invalid base64 returned by server (${String(
          e?.message || e
        )})`
      );
    }

    const blob = new Blob([binary], { type: contentType || 'audio/mpeg' });
    const objectUrl = URL.createObjectURL(blob);

    await new Promise<void>((resolve, reject) => {
      const audio = new (globalThis as any).Audio(objectUrl);

      const cleanup = () => {
        URL.revokeObjectURL(objectUrl);
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
      };

      const onEnded = () => {
        cleanup();
        resolve();
      };

      const onError = (err: any) => {
        cleanup();
        reject(err);
      };

      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);

      audio
        .play()
        .catch((err: any) => {
          cleanup();
          reject(err);
        });
    });
  } else {
    // Native: use expo-av, and resolve when playback finishes.
    const sound = new Audio.Sound();

    await new Promise<void>((resolve, reject) => {
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (!status?.isLoaded && status?.error) {
          sound
            .unloadAsync()
            .catch(() => {})
            .finally(() => reject(new Error(status.error)));
        } else if (status?.isLoaded && status?.didJustFinish) {
          sound
            .unloadAsync()
            .catch(() => {})
            .finally(() => resolve());
        }
      });

      sound
        .loadAsync({ uri: `data:audio/mpeg;base64,${b64}` })
        .then(() => sound.playAsync())
        .catch((err) => {
          sound
            .unloadAsync()
            .catch(() => {})
            .finally(() => reject(err));
        });
    });
  }
}

export default { speakText };
