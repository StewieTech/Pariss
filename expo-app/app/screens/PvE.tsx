import { useRef, useState } from 'react';
import SendButton from '../components/SendButton';
import { sanitizeVariant } from '../lib/utils';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LolaVoiceButton } from '../components/LolaVoiceButton';
import { translateFirst, TranslateButton } from '../components/TranslateButton';
import { LolaChatInput } from '../components/LolaChatInput';
import ModeToggle from '../components/ModeToggle';
import ChatBubble from '../components/ChatBubble';
import ChatMessageList from '../components/ChatMessageList';
import { useAuth } from '../lib/auth';
import LanguageSelector from '../components/LanguageSelector';

import { getLanguageMeta, type AppLanguage } from '../lib/languages';
import type { TtsProvider } from '../lib/api';
import { useVoiceConversation } from '../hooks/useVoiceConversation';

const COMPOSER_HEIGHT = 72;

type PveMode = 'm1' | 'm3';

type PvEScreenProps = {
  mode?: PveMode;
  onModeChange?: (mode: PveMode) => void;
  language: AppLanguage;
  onLanguageChange: (language: AppLanguage) => void;
  conversationId: string;
};

export default function PvEScreen({
  mode: controlledMode,
  onModeChange,
  language,
  onLanguageChange,
  conversationId,
}: PvEScreenProps) {
  const { user, hasProfileName } = useAuth();

  const [text, setText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const sendRef = useRef<{ send?: () => void } | null>(null);
  const [internalMode, setInternalMode] = useState<PveMode>(controlledMode ?? 'm1');
  const [translateOptions, setTranslateOptions] = useState<string[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>('openai');

  const isWeb = Platform.OS === 'web';
  const mode = controlledMode ?? internalMode;
  const languageMeta = getLanguageMeta(language);
  const isVoiceMode = mode === 'm3';
  const voiceConversation = useVoiceConversation({
    language,
    conversationId,
    ttsProvider,
    onTurnComplete: (response) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'user',
          content: response.transcript,
          ...(hasProfileName ? { name: user?.profile?.name } : {}),
        },
        {
          role: 'assistant',
          content: response.assistantText,
          englishTranslation: response.englishTranslation,
          audioBase64: response.audioBase64,
          audioContentType: response.audioContentType,
        },
      ]);
    },
  });
  const voiceBusy = ['recording', 'uploading', 'thinking', 'speaking'].includes(
    voiceConversation.state
  );
  const webComposerPadding = COMPOSER_HEIGHT + 16;
  const webOverlayOffset = COMPOSER_HEIGHT + 28;

  function handleModeChange(nextMode: PveMode) {
    if (controlledMode == null) setInternalMode(nextMode);
    onModeChange?.(nextMode);
  }

  function handleModeToggleChange(nextMode: 'm1' | 'm2' | 'm3') {
    if (nextMode === 'm2') return;
    handleModeChange(nextMode);
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
    >
      <View className="flex-1 w-full self-center max-w-3xl px-3">
        {/* Header */}
        <View className="mb-3 pt-2">
          <ModeToggle<'m1' | 'm2' | 'm3'>
            value={mode}
            onChange={handleModeToggleChange}
            items={[
              { label: 'm1: LolaChat', value: 'm1' },
              { label: 'm3: $ LolaVoice', value: 'm3' },
            ]}
          />
        </View>

        <View className="mb-2 flex-row items-center gap-2 px-1 flex-wrap">
          <LanguageSelector
            language={language}
            onChange={onLanguageChange}
          />

          {isVoiceMode && (
            <View className="flex-row items-center gap-1">
              <TouchableOpacity
                onPress={() => setTtsProvider('openai')}
                className={`rounded-full border px-2.5 py-1.5 ${
                  ttsProvider === 'openai'
                    ? 'border-violet-600 bg-violet-600'
                    : 'border-gray-300 bg-white'
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    ttsProvider === 'openai' ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  Standard
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTtsProvider('elevenlabs')}
                className={`rounded-full border px-2.5 py-1.5 ${
                  ttsProvider === 'elevenlabs'
                    ? 'border-amber-600 bg-amber-600'
                    : 'border-gray-300 bg-white'
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    ttsProvider === 'elevenlabs' ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  Premium
                </Text>
              </TouchableOpacity>

            </View>
          )}
        </View>

        {/* List */}
        <ChatMessageList<any>
          data={messages}
          keyExtractor={(i, idx) => String(idx)}
          bottomPadding={isWeb ? webComposerPadding : 12}
          overlayBottomOffset={isWeb ? webOverlayOffset : 84}
          header={
            translateOptions.length > 0 ? (
              <View className="p-3 mb-3 rounded-2xl bg-amber-50 border border-amber-200">
                <Text className="font-semibold text-amber-900 mb-2">
                  Choose a translation
                </Text>
                {translateOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => {
                      setText(sanitizeVariant(opt));
                      setTranslateOptions([]);
                    }}
                    className="px-3 py-2 rounded-xl bg-white border border-amber-100 mb-2"
                    activeOpacity={0.85}
                  >
                    <Text className="text-gray-900">{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <ChatBubble
              role={item?.role}
              content={item?.content}
              footer={
                item?.role === 'assistant' && mode === 'm3' ? (
                  <View>
                    {item?.englishTranslation ? (
                      <Text className="text-sm text-gray-500 italic mb-2">
                        {item.englishTranslation}
                      </Text>
                    ) : null}
                    <LolaVoiceButton
                      lolaReply={item?.content}
                      audioBase64={item?.audioBase64}
                      audioContentType={item?.audioContentType}
                      defaultSpeed={1.0}
                    />
                  </View>
                ) : null
              }
            />
          )}
        />

        {/* Composer */}
        <View
          style={
            isWeb
              ? {
                  position: 'fixed',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'white',
                  borderTopWidth: 1,
                  borderTopColor: '#e5e7eb',
                  paddingTop: 8,
                  paddingBottom: 16,
                  paddingLeft: 12,
                  paddingRight: 12,
                } as any
              : {}
          }
          className={!isWeb ? 'border-t border-gray-200 bg-white pt-2 pb-4' : ''}
        >
          {/* keep the same max width on web fixed bar */}
          <View className={isWeb ? 'w-full self-center max-w-3xl' : ''}>
            {/* Voice status bar — only when actively recording/processing */}
            {isVoiceMode && voiceConversation.state !== 'idle' && (
              <View className="mb-2 flex-row items-center gap-2 px-1">
                <View
                  className={`h-2 w-2 rounded-full ${
                    voiceConversation.state === 'recording'
                      ? 'bg-rose-500'
                      : voiceConversation.state === 'error'
                      ? 'bg-amber-500'
                      : 'bg-violet-500'
                  }`}
                />
                <Text
                  className={`text-xs font-semibold ${
                    voiceConversation.state === 'recording'
                      ? 'text-rose-600'
                      : voiceConversation.state === 'error'
                      ? 'text-amber-600'
                      : 'text-violet-600'
                  }`}
                >
                  {voiceConversation.state === 'recording'
                    ? `Listening ${Math.round(voiceConversation.durationMs / 1000)}s`
                    : voiceConversation.state === 'uploading'
                    ? 'Sending...'
                    : voiceConversation.state === 'thinking'
                    ? 'Lola is thinking...'
                    : voiceConversation.state === 'speaking'
                    ? 'Lola is speaking...'
                    : voiceConversation.state === 'error'
                    ? voiceConversation.error || 'Something went wrong'
                    : ''}
                </Text>
                {voiceConversation.state === 'recording' && (
                  <TouchableOpacity
                    onPress={voiceConversation.cancelRecording}
                    className="ml-auto rounded-full border border-gray-300 px-2 py-0.5"
                  >
                    <Text className="text-xs font-medium text-gray-600">Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View className="flex-row items-end gap-2 px-1">
              {/* Mic button — shown in voice mode */}
              {isVoiceMode && (
                <TouchableOpacity
                  onPress={() => {
                    if (!voiceConversation.isSupported) return;
                    if (voiceConversation.state === 'recording') {
                      voiceConversation.stopRecording();
                    } else if (!voiceBusy) {
                      voiceConversation.startRecording();
                    }
                  }}
                  disabled={!voiceConversation.isSupported || (voiceBusy && voiceConversation.state !== 'recording')}
                  activeOpacity={0.8}
                  className={`items-center justify-center rounded-full ${
                    voiceConversation.state === 'recording'
                      ? 'bg-rose-500'
                      : voiceBusy
                      ? 'bg-gray-200'
                      : 'bg-violet-600'
                  }`}
                  style={{ width: 44, height: 44 }}
                >
                  <Text className="text-lg text-white">
                    {voiceConversation.state === 'recording' ? '■' : '🎙'}
                  </Text>
                </TouchableOpacity>
              )}

              <View className="flex-1">
                <LolaChatInput
                  value={text}
                  onChangeText={setText}
                  onSend={() => sendRef.current?.send?.()}
                  placeholder={
                    isVoiceMode
                      ? `Type or tap mic • ${languageMeta.label}`
                      : "Ask Lola a question, like 'What's your idea of a perfect day?'"
                  }
                  placeholderTextColor="#9CA3AF"
                  inputStyle={{
                    borderWidth: 1,
                    borderColor: '#d1d5db',
                    borderRadius: 16,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    minHeight: 44,
                    maxHeight: 120,
                  }}
                />
              </View>

              <TranslateButton
                title="Translate"
                loadingTitle="Translating..."
                loading={isTranslating}
                disabled={!text}
                onPress={async () => {
                  if (!text) return;
                  setIsTranslating(true);
                  setTranslateOptions([]);
                  try {
                    const variants = await translateFirst(text, language);
                    setTranslateOptions(variants.length ? variants.slice(0, 3) : ['(no variants)']);
                  } catch (e) {
                    console.error('TranslateFirst failed', e);
                    setTranslateOptions([`(translation failed) ${String(e)}`]);
                  } finally {
                    setIsTranslating(false);
                  }
                }}
              />

              <SendButton
                ref={sendRef}
                text={text}
                setText={setText}
                messages={messages}
                setMessages={(updater: any) => {
                  setMessages((prev) => {
                    const next = typeof updater === 'function' ? updater(prev) : updater;
                    if (!Array.isArray(next)) return next;
                    const out = [...next];
                    const last = out[out.length - 1];
                    if (last && last.role === 'user' && hasProfileName) {
                      out[out.length - 1] = { ...last, name: user?.profile?.name };
                    }
                    return out;
                  });
                }}
                mode={mode}
                language={language}
                conversationId={conversationId}
                disabled={voiceBusy}
                label={isVoiceMode ? 'Send' : undefined}
              />
            </View>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
