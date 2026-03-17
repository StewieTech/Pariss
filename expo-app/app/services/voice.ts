// voice.ts

import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import { API_BASE } from '../lib/config'; // adjust path if needed

type VoiceCacheEntry = {
  b64: string;
  contentType: string;
};

type ActivePlayback = {
  stop: () => Promise<void>;
  settle: (outcome: 'finished' | 'stopped' | 'error', error?: any) => void;
};

const voiceCache = new Map<string, VoiceCacheEntry>();
let activePlayback: ActivePlayback | null = null;

export async function stopPlayback(): Promise<void> {
  const currentPlayback = activePlayback;
  activePlayback = null;

  if (!currentPlayback) return;

  await currentPlayback.stop().catch(() => {});
  currentPlayback.settle('stopped');
}

export async function playBase64Audio(
  b64: string,
  contentType = 'audio/mpeg'
): Promise<void> {
  if (!b64) return;

  await stopPlayback();

  if (Platform.OS === 'web') {
    let binary: Uint8Array;
    try {
      binary = Uint8Array.from(atob(b64), (char) => char.charCodeAt(0));
    } catch (err: any) {
      throw new Error(
        `TTS decode failed: invalid base64 returned by server (${String(
          err?.message || err
        )})`
      );
    }

    const normalizedBinary = new Uint8Array(binary.length);
    normalizedBinary.set(binary);
    const blob = new Blob([normalizedBinary.buffer], {
      type: contentType || 'audio/mpeg',
    });
    const objectUrl = URL.createObjectURL(blob);

    await new Promise<void>((resolve, reject) => {
      const audio = new (globalThis as any).Audio(objectUrl);
      let settled = false;

      const settle = (outcome: 'finished' | 'stopped' | 'error', error?: any) => {
        if (settled) return;
        settled = true;
        if (activePlayback?.settle === settle) activePlayback = null;
        if (outcome === 'error') reject(error);
        else resolve();
      };

      const cleanup = () => {
        URL.revokeObjectURL(objectUrl);
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
      };

      const stop = async () => {
        cleanup();
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch {
          // ignore playback cleanup issues
        }
      };

      const onEnded = () => {
        cleanup();
        settle('finished');
      };

      const onError = (err: any) => {
        cleanup();
        settle('error', err);
      };

      activePlayback = { stop, settle };

      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);

      audio.play().catch((err: any) => {
        cleanup();
        settle('error', err);
      });
    });

    return;
  }

  const sound = new Audio.Sound();

  await new Promise<void>((resolve, reject) => {
    let settled = false;

    const settle = (outcome: 'finished' | 'stopped' | 'error', error?: any) => {
      if (settled) return;
      settled = true;
      if (activePlayback?.settle === settle) activePlayback = null;
      if (outcome === 'error') reject(error);
      else resolve();
    };

    const stop = async () => {
      try {
        await sound.stopAsync();
      } catch {
        // ignore
      }
      try {
        await sound.unloadAsync();
      } catch {
        // ignore
      }
    };

    activePlayback = { stop, settle };

    sound.setOnPlaybackStatusUpdate((status: any) => {
      if (!status?.isLoaded && status?.error) {
        void stop().finally(() => settle('error', new Error(status.error)));
        return;
      }

      if (status?.isLoaded && status?.didJustFinish) {
        void stop().finally(() => settle('finished'));
      }
    });

    sound
      .loadAsync({ uri: `data:${contentType || 'audio/mpeg'};base64,${b64}` })
      .then(() => sound.playAsync())
      .catch((err) => {
        void stop().finally(() => settle('error', err));
      });
  });
}

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
    const contentType =
      resp.headers.get('x-audio-content-type') ||
      resp.headers.get('content-type') ||
      'audio/mpeg';

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
  await playBase64Audio(b64, contentType);
}

export default { speakText, playBase64Audio, stopPlayback };
