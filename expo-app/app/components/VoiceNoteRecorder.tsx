import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Animated,
} from 'react-native';
import { Audio } from 'expo-av';

type RecordingState = 'idle' | 'recording' | 'uploading';

type Props = {
  onRecordingComplete: (audioBase64: string, mimeType: string, durationMs: number) => Promise<void>;
  suggestion?: string | null;
  isLoadingSuggestion?: boolean;
  disabled?: boolean;
  highlighted?: boolean;
  reviewInstruction?: string | null;
};

function isWebMicSupported() {
  if (Platform.OS !== 'web') return true;
  return typeof navigator !== 'undefined' && !!navigator?.mediaDevices?.getUserMedia;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

export default function VoiceNoteRecorder({
  onRecordingComplete,
  suggestion,
  isLoadingSuggestion,
  disabled,
  highlighted,
  reviewInstruction,
}: Props) {
  const [state, setState] = useState<RecordingState>('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const webRecorderRef = useRef<MediaRecorder | null>(null);
  const webStreamRef = useRef<MediaStream | null>(null);
  const webChunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      try { webRecorderRef.current?.stop(); } catch {}
      if (webStreamRef.current) {
        webStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (state === 'recording') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else if (highlighted) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      // Gentle idle pulse to attract attention
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [state, pulseAnim, highlighted]);

  const startTimer = useCallback(() => {
    startedAtRef.current = Date.now();
    setDurationMs(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!mountedRef.current || !startedAtRef.current) return;
      setDurationMs(Date.now() - startedAtRef.current);
    }, 200);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const dur = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
    startedAtRef.current = null;
    return dur;
  }, []);

  const startRecording = useCallback(async () => {
    if (state !== 'idle') return;
    setError(null);

    if (Platform.OS === 'web') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        webStreamRef.current = stream;
        webChunksRef.current = [];

        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) webChunksRef.current.push(e.data);
        };
        webRecorderRef.current = recorder;
        recorder.start();
        startTimer();
        if (mountedRef.current) setState('recording');
      } catch (e: any) {
        setError('Microphone access denied');
      }
    } else {
      try {
        const { granted } = await Audio.requestPermissionsAsync();
        if (!granted) { setError('Microphone permission denied'); return; }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        recordingRef.current = recording;
        startTimer();
        if (mountedRef.current) setState('recording');
      } catch (e: any) {
        setError('Could not start recording');
      }
    }
  }, [state, startTimer]);

  const stopRecording = useCallback(async () => {
    if (state !== 'recording') return;
    const dur = stopTimer();
    if (mountedRef.current) setState('uploading');

    if (Platform.OS === 'web') {
      const recorder = webRecorderRef.current;
      if (!recorder) { setState('idle'); return; }

      await new Promise<void>((resolve) => {
        recorder.onstop = async () => {
          try {
            const blob = new Blob(webChunksRef.current, { type: 'audio/webm' });
            const audioBase64 = await blobToBase64(blob);
            await onRecordingComplete(audioBase64, 'audio/webm', dur);
          } catch (e: any) {
            if (mountedRef.current) setError('Failed to send voice note');
          } finally {
            if (webStreamRef.current) {
              webStreamRef.current.getTracks().forEach((t) => t.stop());
              webStreamRef.current = null;
            }
            webRecorderRef.current = null;
            if (mountedRef.current) setState('idle');
            resolve();
          }
        };
        if (recorder.state !== 'inactive') recorder.stop();
        else resolve();
      });
    } else {
      const recording = recordingRef.current;
      if (!recording) { setState('idle'); return; }

      try {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        recordingRef.current = null;

        if (!uri) throw new Error('No recording URI');

        const response = await fetch(uri);
        const blob = await response.blob();
        const audioBase64 = await blobToBase64(blob);
        const mimeType = uri.endsWith('.m4a') ? 'audio/mp4' : 'audio/webm';

        await onRecordingComplete(audioBase64, mimeType, dur);
      } catch (e: any) {
        if (mountedRef.current) setError('Failed to send voice note');
      } finally {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
        if (mountedRef.current) setState('idle');
      }
    }
  }, [state, stopTimer, onRecordingComplete]);

  const cancelRecording = useCallback(() => {
    stopTimer();
    if (Platform.OS === 'web') {
      try { webRecorderRef.current?.stop(); } catch {}
      if (webStreamRef.current) {
        webStreamRef.current.getTracks().forEach((t) => t.stop());
        webStreamRef.current = null;
      }
      webRecorderRef.current = null;
    } else {
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
      Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
    }
    if (mountedRef.current) {
      setState('idle');
      setDurationMs(0);
    }
  }, [stopTimer]);

  const supported = isWebMicSupported();
  if (!supported) return null;

  const seconds = Math.floor(durationMs / 1000);

  return (
    <View>
      {/* AI Suggestion overlay — shown when recording */}
      {state === 'recording' && suggestion && (
        <View className="mb-2 px-3 py-2.5 rounded-2xl bg-violet-50 border border-violet-200">
          <Text className="text-xs font-semibold text-violet-700 mb-0.5">
            Try saying:
          </Text>
          <Text className="text-sm text-violet-900 italic">
            "{suggestion}"
          </Text>
          <Text className="text-xs text-gray-400 mt-1">
            …or say something else!
          </Text>
        </View>
      )}

      {isLoadingSuggestion && state === 'idle' && (
        <View className="mb-2 flex-row items-center gap-1.5 px-1">
          <ActivityIndicator size="small" color="#7c3aed" />
          <Text className="text-xs text-violet-600">Getting a suggestion…</Text>
        </View>
      )}

      {/* Review instruction */}
      {reviewInstruction && state === 'idle' && (
        <View className="mb-2 px-3 py-2 rounded-2xl bg-amber-50 border border-amber-200">
          <Text className="text-sm font-semibold text-amber-800">
            {reviewInstruction}
          </Text>
        </View>
      )}

      {/* Recording controls */}
      <View className="flex-row items-center gap-2">
        {state === 'idle' && (
          <Animated.View style={{
            transform: [{ scale: pulseAnim }],
            ...(highlighted ? { shadowColor: '#e11d48', shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 } : {}),
          }}>
            <TouchableOpacity
              onPress={startRecording}
              disabled={disabled || state !== 'idle'}
              className={`w-12 h-12 rounded-full items-center justify-center ${
                disabled ? 'bg-gray-200' : highlighted ? 'bg-rose-600' : 'bg-rose-500'
              }`}
              style={highlighted ? { borderWidth: 2, borderColor: '#fda4af' } : {}}
            >
              <Text className="text-white text-xl">🎙</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {state === 'recording' && (
          <>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <View className="w-3 h-3 rounded-full bg-rose-500" />
            </Animated.View>
            <Text className="text-sm font-semibold text-gray-700">
              Recording {seconds}s
            </Text>
            <TouchableOpacity
              onPress={stopRecording}
              className="px-3 py-1.5 rounded-full bg-violet-600"
            >
              <Text className="text-white text-xs font-semibold">Send</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={cancelRecording}
              className="px-3 py-1.5 rounded-full bg-gray-200"
            >
              <Text className="text-gray-600 text-xs font-semibold">Cancel</Text>
            </TouchableOpacity>
          </>
        )}

        {state === 'uploading' && (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator size="small" color="#7c3aed" />
            <Text className="text-sm text-gray-500">Sending voice note…</Text>
          </View>
        )}
      </View>

      {error && (
        <Text className="text-xs text-rose-500 mt-1 px-1">{error}</Text>
      )}
    </View>
  );
}
