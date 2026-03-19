import React, { useState, useCallback } from 'react';
import { Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { playBase64Audio } from '../services/voice';
import { API } from '../lib/config';

const SPEED_OPTIONS = [
  { label: '1x', value: 1.0 },
  { label: 'Slow', value: 0.75 },
  { label: 'V. Slow', value: 0.5 },
] as const;

type Props = {
  lolaReply: string;
  voiceId?: string;
  audioBase64?: string;
  audioContentType?: string;
  defaultSpeed?: number;
};

export function LolaVoiceButton({
  lolaReply,
  voiceId,
  audioBase64,
  audioContentType,
  defaultSpeed = 1.0,
}: Props) {
  const [hasPlayed, setHasPlayed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedAudio, setCachedAudio] = useState<{ b64: string; contentType: string } | null>(null);

  const play = useCallback(
    async (rate: number = 1.0) => {
      if (isBusy) return;

      setError(null);
      setIsBusy(true);

      try {
        // Use prop audio, local cache, or fetch from TTS backend
        let audio = audioBase64
          ? { b64: audioBase64, contentType: audioContentType || 'audio/mpeg' }
          : cachedAudio;

        if (!audio) {
          // Fetch TTS audio from backend and cache locally
          const resp = await fetch(`${API}/chat/tts`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: lolaReply, voiceId }),
          });
          if (!resp.ok) throw new Error(`TTS failed (${resp.status})`);
          const b64 = await resp.text();
          const ct = resp.headers.get('x-audio-content-type') || 'audio/mpeg';
          audio = { b64, contentType: ct };
          setCachedAudio(audio);
        }

        await playBase64Audio(audio.b64, audio.contentType, rate);
        setHasPlayed(true);
      } catch (e: any) {
        console.error('Lola TTS error', e);
        setError(e?.message || 'Something went wrong with Lola voice');
      } finally {
        setIsBusy(false);
      }
    },
    [isBusy, lolaReply, voiceId, audioBase64, audioContentType, cachedAudio]
  );

  const label = isBusy
    ? 'Playing…'
    : hasPlayed
    ? 'Replay'
    : 'Hear Lola';

  return (
    <View style={{ gap: 8 }}>
      {/* Primary play button — uses global speed setting */}
      <TouchableOpacity
        onPress={() => play(defaultSpeed)}
        disabled={isBusy}
        className={`self-start rounded-full px-4 py-2 ${
          isBusy ? 'bg-pink-300' : 'bg-pink-500'
        }`}
      >
        <Text className="text-white font-semibold text-sm">{label}</Text>
      </TouchableOpacity>

      {/* Speed replay row — visible when audio is cached (prop or fetched) */}
      {!isBusy && (audioBase64 || cachedAudio) && (
        <View className="flex-row items-center gap-1.5">
          <Text className="text-xs text-gray-400 mr-1">Speed:</Text>
          {SPEED_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => play(opt.value)}
              className={`rounded-full border px-2.5 py-1 ${
                opt.value === 1.0
                  ? 'border-pink-300 bg-pink-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <Text className="text-xs font-medium text-gray-700">
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {isBusy && <ActivityIndicator size="small" />}

      {error && (
        <Text className="text-xs text-rose-600 mt-1">{error}</Text>
      )}
    </View>
  );
}
