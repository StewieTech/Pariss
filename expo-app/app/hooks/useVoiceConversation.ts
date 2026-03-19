import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { sendVoiceTurn, type VoiceTurnResponse, type TtsProvider } from '../lib/api';
import type { AppLanguage } from '../lib/languages';
import { playBase64Audio, stopPlayback } from '../services/voice';

export type VoiceConversationState =
  | 'idle'
  | 'recording'
  | 'uploading'
  | 'thinking'
  | 'speaking'
  | 'error';

const DEFAULT_MAX_RECORDING_MS = 20000;
const DURATION_UPDATE_MS = 200;

function getMimeTypeForUri(uri: string) {
  const normalizedUri = String(uri || '').toLowerCase();

  if (normalizedUri.endsWith('.webm')) return 'audio/webm';
  if (normalizedUri.endsWith('.caf')) return 'audio/x-caf';
  if (normalizedUri.endsWith('.wav')) return 'audio/wav';
  if (normalizedUri.endsWith('.mp3')) return 'audio/mpeg';
  return 'audio/mp4';
}

function isWebVoiceSupported() {
  if (Platform.OS !== 'web') return true;
  return Boolean(
    typeof navigator !== 'undefined' &&
      navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== 'undefined'
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.replace(/^data:[^;]+;base64,/, ''));
    };

    reader.onerror = () => {
      reject(reader.error || new Error('Could not read recorded audio.'));
    };

    reader.readAsDataURL(blob);
  });
}

export function useVoiceConversation({
  language,
  conversationId,
  voiceId,
  ttsProvider = 'openai',
  speed = 1.0,
  maxRecordingMs = DEFAULT_MAX_RECORDING_MS,
  onTurnComplete,
}: {
  language: AppLanguage;
  conversationId: string;
  voiceId?: string;
  ttsProvider?: TtsProvider;
  speed?: number;
  maxRecordingMs?: number;
  onTurnComplete?: (response: VoiceTurnResponse) => void;
}) {
  const [state, setState] = useState<VoiceConversationState>('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState('');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const webRecorderRef = useRef<MediaRecorder | null>(null);
  const webStreamRef = useRef<MediaStream | null>(null);
  const webChunksRef = useRef<Blob[]>([]);
  const shouldSendWebRecordingRef = useRef(false);
  const recordingStartedAtRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const isSupported = isWebVoiceSupported();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      shouldSendWebRecordingRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);

      const recording = recordingRef.current;
      recordingRef.current = null;

      if (recording) {
        void recording.stopAndUnloadAsync().catch(() => {});
      }

      try {
        webRecorderRef.current?.stop();
      } catch {
        // ignore web recorder cleanup errors
      }
      webRecorderRef.current = null;

      if (webStreamRef.current) {
        webStreamRef.current.getTracks().forEach((track) => track.stop());
        webStreamRef.current = null;
      }

      void stopPlayback();
    };
  }, []);

  function clearRecordingTimeout() {
    if (!timeoutRef.current) return;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }

  function clearDurationInterval() {
    if (!durationIntervalRef.current) return;
    clearInterval(durationIntervalRef.current);
    durationIntervalRef.current = null;
  }

  function startDurationTicker() {
    recordingStartedAtRef.current = Date.now();
    clearDurationInterval();
    durationIntervalRef.current = setInterval(() => {
      const startedAt = recordingStartedAtRef.current;
      if (!startedAt || !mountedRef.current) return;
      setDurationMs(Date.now() - startedAt);
    }, DURATION_UPDATE_MS);
  }

  function stopDurationTicker() {
    recordingStartedAtRef.current = null;
    clearDurationInterval();
  }

  function cleanupWebStream() {
    if (!webStreamRef.current) return;
    webStreamRef.current.getTracks().forEach((track) => track.stop());
    webStreamRef.current = null;
  }

  async function processVoiceTurn({
    audioBase64,
    mimeType,
  }: {
    audioBase64: string;
    mimeType: string;
  }) {
    if (mountedRef.current) setState('thinking');

    const response = await sendVoiceTurn({
      audioBase64,
      mimeType,
      language,
      conversationId,
      voiceId,
      ttsProvider,
    });

    if (!mountedRef.current) return;

    setLastTranscript(response.transcript);
    onTurnComplete?.(response);

    if (response.audioBase64) {
      setState('speaking');
      await playBase64Audio(response.audioBase64, response.audioContentType, speed);
    }

    if (!mountedRef.current) return;
    setError(null);
    setState('idle');
    setDurationMs(0);
  }

  async function setRecordingMode(enabled: boolean) {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: enabled,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  }

  async function cancelRecording() {
    clearRecordingTimeout();
    stopDurationTicker();
    const recording = recordingRef.current;
    recordingRef.current = null;
    setDurationMs(0);

    if (Platform.OS === 'web') {
      shouldSendWebRecordingRef.current = false;
      webChunksRef.current = [];
      const webRecorder = webRecorderRef.current;
      webRecorderRef.current = null;

      if (!webRecorder) {
        setState('idle');
        return;
      }

      try {
        if (webRecorder.state !== 'inactive') {
          webRecorder.stop();
        }
      } catch {
        cleanupWebStream();
      } finally {
        cleanupWebStream();
        if (mountedRef.current) setState('idle');
      }
      return;
    }

    if (!recording) {
      setState('idle');
      return;
    }

    try {
      await recording.stopAndUnloadAsync();
    } catch {
      // ignore recorder cleanup errors
    } finally {
      await setRecordingMode(false).catch(() => {});
      if (mountedRef.current) setState('idle');
    }
  }

  async function startRecording() {
    if (!isSupported) {
      setError('Your browser could not start microphone recording. You can still type below.');
      setState('error');
      return;
    }

    if (state !== 'idle' && state !== 'error') return;

    try {
      setError(null);
      setLastTranscript('');
      setDurationMs(0);
      await stopPlayback();

      if (Platform.OS === 'web') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);

        webStreamRef.current = stream;
        webRecorderRef.current = recorder;
        webChunksRef.current = [];
        shouldSendWebRecordingRef.current = true;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            webChunksRef.current.push(event.data);
          }
        };

        recorder.onerror = () => {
          stopDurationTicker();
          shouldSendWebRecordingRef.current = false;
          cleanupWebStream();
          webRecorderRef.current = null;
          if (!mountedRef.current) return;
          setError('The browser recorder hit an error. Please try again.');
          setState('error');
        };

        recorder.onstop = () => {
          const shouldSend = shouldSendWebRecordingRef.current;
          const mimeType = recorder.mimeType || 'audio/webm';
          const blob = new Blob(webChunksRef.current, { type: mimeType });

          webChunksRef.current = [];
          cleanupWebStream();
          webRecorderRef.current = null;

          if (!shouldSend || blob.size === 0) {
            if (mountedRef.current) {
              setState('idle');
              setDurationMs(0);
            }
            return;
          }

          void (async () => {
            try {
              if (mountedRef.current) setState('uploading');
              const audioBase64 = await blobToBase64(blob);
              await processVoiceTurn({ audioBase64, mimeType });
            } catch (err: any) {
              if (!mountedRef.current) return;
              setError(err?.message || 'Voice turn failed.');
              setState('error');
            }
          })();
        };

        recorder.start();
        startDurationTicker();
        setState('recording');
        timeoutRef.current = setTimeout(() => {
          void stopRecording();
        }, maxRecordingMs);
        return;
      }

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Microphone access is required so Lola can hear you.');
      }

      await setRecordingMode(true);

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
          if (!mountedRef.current) return;
          if (status?.isRecording) {
            setDurationMs(status.durationMillis ?? 0);
          }
        },
        200
      );

      recordingRef.current = recording;
      startDurationTicker();
      setState('recording');
      timeoutRef.current = setTimeout(() => {
        void stopRecording();
      }, maxRecordingMs);
    } catch (err: any) {
      await setRecordingMode(false).catch(() => {});
      if (!mountedRef.current) return;
      setError(err?.message || 'Recording could not start.');
      setState('error');
    }
  }

  async function stopRecording() {
    if (Platform.OS === 'web') {
      const webRecorder = webRecorderRef.current;
      if (!webRecorder) return;

      shouldSendWebRecordingRef.current = true;
      clearRecordingTimeout();
      stopDurationTicker();

      try {
        if (mountedRef.current) setState('uploading');
        if (webRecorder.state !== 'inactive') {
          webRecorder.stop();
        }
      } catch (err: any) {
        cleanupWebStream();
        webRecorderRef.current = null;
        if (!mountedRef.current) return;
        setError(err?.message || 'Recording could not stop cleanly.');
        setState('error');
      }
      return;
    }

    const recording = recordingRef.current;
    if (!recording) return;

    recordingRef.current = null;
    clearRecordingTimeout();
    stopDurationTicker();

    try {
      if (mountedRef.current) setState('uploading');
      await recording.stopAndUnloadAsync();
      await setRecordingMode(false).catch(() => {});

      const uri = recording.getURI();
      if (!uri) throw new Error('Recording finished, but no audio file was available.');

      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const mimeType = getMimeTypeForUri(uri);
      await processVoiceTurn({ audioBase64, mimeType });
    } catch (err: any) {
      await setRecordingMode(false).catch(() => {});
      if (!mountedRef.current) return;
      setError(err?.message || 'Voice turn failed.');
      setState('error');
    }
  }

  return {
    state,
    durationMs,
    error,
    isSupported,
    lastTranscript,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}

export default useVoiceConversation;
