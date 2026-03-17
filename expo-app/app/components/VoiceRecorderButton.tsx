import { Platform, Text, TouchableOpacity, View } from 'react-native';
import type { VoiceConversationState } from '../hooks/useVoiceConversation';

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function VoiceRecorderButton({
  state,
  durationMs = 0,
  transcript,
  error,
  languageLabel,
  isSupported,
  onStart,
  onStop,
  onCancel,
}: {
  state: VoiceConversationState;
  durationMs?: number;
  transcript?: string;
  error?: string | null;
  languageLabel: string;
  isSupported: boolean;
  onStart: () => void;
  onStop: () => void;
  onCancel?: () => void;
}) {
  const isWeb = Platform.OS === 'web';
  const isRecording = state === 'recording';
  const isBusy =
    state === 'uploading' || state === 'thinking' || state === 'speaking';

  const badgeLabel =
    state === 'recording'
      ? `Listening ${formatDuration(durationMs)}`
      : state === 'uploading'
      ? 'Uploading'
      : state === 'thinking'
      ? 'Thinking'
      : state === 'speaking'
      ? 'Speaking'
      : state === 'error'
      ? 'Needs retry'
      : 'Ready';

  const helperText = !isSupported
    ? 'This browser does not support microphone capture here yet. You can still use the typed fallback below.'
    : isRecording
    ? 'Say a sentence naturally, then tap again when you want Lola to answer.'
    : state === 'uploading'
    ? 'Sending your recording so Lola can hear it clearly.'
    : state === 'thinking'
    ? 'Lola is transcribing, correcting, and preparing her spoken reply.'
    : state === 'speaking'
    ? 'Lola is answering out loud in your selected language.'
    : isWeb
    ? 'Tap once to speak. Your browser may ask for microphone access the first time.'
    : 'Tap once to speak. Lola will listen, respond in the selected language, and speak back.';

  const buttonLabel = !isSupported
    ? 'Use typed fallback'
    : isRecording
    ? 'Stop and send'
    : state === 'uploading'
    ? 'Uploading...'
    : state === 'thinking'
    ? 'Lola is thinking...'
    : state === 'speaking'
    ? 'Lola is speaking...'
    : 'Start talking';

  const buttonSubLabel = !isSupported
    ? 'Your typed fallback is still ready below.'
    : isRecording
    ? 'Tap when you are ready for Lola to jump in.'
    : isWeb
    ? 'Short turns upload faster and feel more live.'
    : 'Short turns feel the most conversational.';

  const handlePress = () => {
    if (!isSupported || isBusy) return;
    if (isRecording) onStop();
    else onStart();
  };

  return (
    <View className="rounded-3xl border border-violet-200 bg-violet-50 px-4 py-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-xs font-semibold uppercase text-violet-700">
            Live Voice Practice
          </Text>
          <Text className="mt-1 text-lg font-semibold text-gray-900">
            Speak to Lola in {languageLabel}
          </Text>
          <Text className="mt-1 text-sm leading-5 text-gray-600">
            {helperText}
          </Text>
        </View>

        <View
          className={`rounded-full px-3 py-1 ${
            state === 'recording'
              ? 'bg-rose-100'
              : state === 'error'
              ? 'bg-amber-100'
              : 'bg-white'
          }`}
        >
          <Text
            className={`text-xs font-semibold ${
              state === 'recording'
                ? 'text-rose-700'
                : state === 'error'
                ? 'text-amber-700'
                : 'text-violet-700'
            }`}
          >
            {badgeLabel}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={handlePress}
        disabled={!isSupported || isBusy}
        activeOpacity={!isSupported || isBusy ? 1 : 0.9}
        className={`mt-4 rounded-3xl px-4 py-4 ${
          !isSupported || isBusy
            ? 'bg-white border border-violet-100'
            : isRecording
            ? 'bg-rose-500'
            : 'bg-violet-600'
        }`}
      >
        <Text
          className={`text-center text-base font-semibold ${
            !isSupported || isBusy ? 'text-gray-600' : 'text-white'
          }`}
        >
          {buttonLabel}
        </Text>
        <Text
          className={`mt-1 text-center text-xs ${
            !isSupported || isBusy ? 'text-gray-500' : 'text-white/85'
          }`}
        >
          {buttonSubLabel}
        </Text>
      </TouchableOpacity>

      {isRecording && onCancel ? (
        <TouchableOpacity
          onPress={onCancel}
          activeOpacity={0.85}
          className="mt-3 self-start rounded-full border border-violet-200 px-3 py-2"
        >
          <Text className="text-sm font-semibold text-violet-700">Cancel</Text>
        </TouchableOpacity>
      ) : null}

      {transcript ? (
        <View className="mt-3 rounded-2xl border border-violet-100 bg-white px-3 py-3">
          <Text className="text-xs font-semibold uppercase text-violet-700">
            Last Thing Lola Heard
          </Text>
          <Text className="mt-1 text-sm leading-5 text-gray-800">
            {transcript}
          </Text>
        </View>
      ) : null}

      {error ? (
        <Text className="mt-3 text-sm leading-5 text-rose-600">{error}</Text>
      ) : null}
    </View>
  );
}
