import React, { useState, useCallback } from 'react';
import { Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { speakText, playBase64Audio } from '../services/voice';

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

  const play = useCallback(
    async (rate: number = 1.0) => {
      if (isBusy) return;

      setError(null);
      setIsBusy(true);

      try {
        if (audioBase64) {
          await playBase64Audio(
            audioBase64,
            audioContentType || 'audio/mpeg',
            rate
          );
        } else {
          await speakText(lolaReply, voiceId);
        }
        setHasPlayed(true);
      } catch (e: any) {
        console.error('Lola TTS error', e);
        setError(e?.message || 'Something went wrong with Lola voice');
      } finally {
        setIsBusy(false);
      }
    },
    [isBusy, lolaReply, voiceId, audioBase64, audioContentType]
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

      {/* Speed replay row — always visible when cached audio available */}
      {!isBusy && audioBase64 && (
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
