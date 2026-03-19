import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { playBase64Audio } from '../services/voice';
import * as api from '../lib/api';

type Props = {
  msgId: string;
  transcript: string;
  durationMs?: number;
  isOwnMessage?: boolean;
  onReply?: (msgId: string) => void;
  reviewCount?: number;
  hasNewReview?: boolean;
};

function ReviewButton({ onReply, msgId, hasNewReview }: {
  onReply?: (id: string) => void;
  msgId: string;
  hasNewReview?: boolean;
}) {
  // Impeccable: one-time entrance (300ms ease-out), then static — no animation fatigue
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  if (!onReply) return null;

  return (
    <Animated.View style={{ transform: [{ scale }], opacity }}>
      <TouchableOpacity
        onPress={() => onReply(msgId)}
        className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-violet-100 border border-violet-200"
      >
        <Text className="text-xs font-bold text-violet-700">
          Review 🗣
        </Text>
        {hasNewReview && (
          <View className="w-2.5 h-2.5 rounded-full bg-rose-500" />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function VoiceNoteBubble({
  msgId,
  transcript,
  durationMs,
  isOwnMessage,
  onReply,
  reviewCount = 0,
  hasNewReview,
}: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioCache, setAudioCache] = useState<{
    base64: string;
    contentType: string;
  } | null>(null);

  const fetchAndPlay = useCallback(
    async (rate = 1.0) => {
      if (isPlaying || isLoading) return;
      setError(null);

      let audio = audioCache;
      if (!audio) {
        setIsLoading(true);
        try {
          const res = await api.getPvpAudio(msgId);
          audio = { base64: res.audioBase64, contentType: res.audioContentType };
          setAudioCache(audio);
        } catch (e: any) {
          setError('Could not load audio');
          setIsLoading(false);
          return;
        }
        setIsLoading(false);
      }

      setIsPlaying(true);
      try {
        await playBase64Audio(audio.base64, audio.contentType, rate);
      } catch (e: any) {
        setError('Playback failed');
      } finally {
        setIsPlaying(false);
      }
    },
    [msgId, audioCache, isPlaying, isLoading]
  );

  const durationLabel = durationMs
    ? `${Math.round(durationMs / 1000)}s`
    : '';

  return (
    <View className="my-1">
      {/* Voice note card */}
      <View
        className={`rounded-2xl px-3 py-2.5 ${
          isOwnMessage
            ? 'bg-violet-50 border border-violet-200'
            : 'bg-emerald-50 border border-emerald-200'
        }`}
      >
        {/* Waveform-style indicator + play button */}
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => fetchAndPlay(1.0)}
            disabled={isPlaying || isLoading}
            className={`w-9 h-9 rounded-full items-center justify-center ${
              isPlaying
                ? 'bg-gray-300'
                : isOwnMessage
                ? 'bg-violet-500'
                : 'bg-emerald-500'
            }`}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="text-white text-sm font-bold">
                {isPlaying ? '■' : '▶'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Waveform bars (decorative) */}
          <View className="flex-row items-center gap-0.5 flex-1">
            {Array.from({ length: 20 }).map((_, i) => {
              const h = 6 + Math.sin(i * 0.8) * 8 + Math.random() * 4;
              return (
                <View
                  key={i}
                  style={{ height: h, width: 3, borderRadius: 2 }}
                  className={
                    isOwnMessage ? 'bg-violet-300' : 'bg-emerald-300'
                  }
                />
              );
            })}
          </View>

          {durationLabel ? (
            <Text className="text-xs text-gray-400 ml-1">{durationLabel}</Text>
          ) : null}
        </View>

        {/* Transcript */}
        {transcript && transcript !== '(voice note)' ? (
          <Text className="text-xs text-gray-500 mt-1.5 italic">
            "{transcript}"
          </Text>
        ) : null}

        {/* Speed replay row */}
        {audioCache && !isPlaying && (
          <View className="flex-row items-center gap-1.5 mt-2">
            <Text className="text-xs text-gray-400">Replay:</Text>
            {[
              { label: '1x', value: 1.0 },
              { label: 'Slow', value: 0.75 },
              { label: 'V.Slow', value: 0.5 },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => fetchAndPlay(opt.value)}
                className="rounded-full border border-gray-200 bg-white px-2 py-0.5"
              >
                <Text className="text-xs text-gray-600">{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Action row: Review button + review count */}
      <View className="flex-row items-center mt-1 px-1 gap-2">
        <ReviewButton
          onReply={onReply}
          msgId={msgId}
          hasNewReview={hasNewReview}
        />
        {reviewCount > 0 && (
          <Text className="text-xs text-gray-400">
            {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
          </Text>
        )}
      </View>

      {error && (
        <Text className="text-xs text-rose-500 mt-0.5 px-1">{error}</Text>
      )}
    </View>
  );
}
