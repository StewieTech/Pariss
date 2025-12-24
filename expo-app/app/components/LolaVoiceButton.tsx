import React, { useState, useCallback } from 'react';
import { Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { speakText } from '../services/voice'; // adjust path

type Props = {
  lolaReply: string;
  voiceId?: string;
};

export function LolaVoiceButton({ lolaReply, voiceId }: Props) {
  const [hasPlayed, setHasPlayed] = useState(false);
  const [isBusy, setIsBusy] = useState(false); // loading or playing
  const [error, setError] = useState<string | null>(null);

  const handlePress = useCallback(async () => {
    if (isBusy) return; // extra guard

    setError(null);
    setIsBusy(true);

    try {
      // This will resolve when playback is finished (because of updated speakText)
      await speakText(lolaReply, voiceId);
      setHasPlayed(true);
    } catch (e: any) {
      console.error('Lola TTS error', e);
      setError(e?.message || 'Something went wrong with Lola voice');
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, lolaReply, voiceId]);

  const label = isBusy
    ? 'Loading voice…'
    : hasPlayed
    ? 'Play Lola again :)'
    : 'Click to hear Lola :)';

  const disabled = isBusy;

  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 999,
          opacity: disabled ? 0.5 : 1,
          backgroundColor: '#ec4899', // swap for your Tailwind/nativewind classes
        }}
      >
        <Text style={{ color: 'white', fontWeight: '600' }}>
          {label}
        </Text>
      </TouchableOpacity>

      {isBusy && (
        <ActivityIndicator size="small" />
      )}

      {error && (
        <Text style={{ color: 'red', fontSize: 12, marginTop: 4 }}>
          {error}
        </Text>
      )}
    </View>
  );
}
