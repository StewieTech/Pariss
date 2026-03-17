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
import VoiceRecorderButton from '../components/VoiceRecorderButton';
import { getLanguageMeta, type AppLanguage } from '../lib/languages';
import type { TtsProvider } from '../lib/api';
import { useVoiceConversation } from '../hooks/useVoiceConversation';

const COMPOSER_HEIGHT = 92; // tweak if needed

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
    onTurnComplete: ({ transcript, assistantText }) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'user',
          content: transcript,
          ...(hasProfileName ? { name: user?.profile?.name } : {}),
        },
        { role: 'assistant', content: assistantText },
      ]);
    },
  });
  const voiceBusy = ['recording', 'uploading', 'thinking', 'speaking'].includes(
    voiceConversation.state
  );
  const webComposerPadding = isVoiceMode ? 316 : COMPOSER_HEIGHT + 16;
  const webOverlayOffset = isVoiceMode ? 328 : COMPOSER_HEIGHT + 28;

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

        <View className="mb-3">
          <LanguageSelector
            language={language}
            onChange={onLanguageChange}
            title={mode === 'm3' ? 'Voice language' : 'Chat language'}
            subtitle={
              mode === 'm3'
                ? 'Lola will correct and speak in this language.'
                : 'Lola will chat and teach in this language.'
            }
          />
        </View>

        {isVoiceMode && (
          <View className="mb-3 flex-row items-center gap-2 px-1">
            <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Voice:
            </Text>
            <TouchableOpacity
              onPress={() => setTtsProvider('openai')}
              className={`rounded-full border px-3 py-1 ${
                ttsProvider === 'openai'
                  ? 'border-violet-700 bg-violet-700'
                  : 'border-gray-300 bg-white'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  ttsProvider === 'openai' ? 'text-white' : 'text-gray-700'
                }`}
              >
                Standard
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTtsProvider('elevenlabs')}
              className={`rounded-full border px-3 py-1 ${
                ttsProvider === 'elevenlabs'
                  ? 'border-amber-600 bg-amber-600'
                  : 'border-gray-300 bg-white'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  ttsProvider === 'elevenlabs' ? 'text-white' : 'text-gray-700'
                }`}
              >
                Premium
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* List */}
        <ChatMessageList<any>
          data={messages}
          keyExtractor={(i, idx) => String(idx)}
          bottomPadding={isWeb ? webComposerPadding : 12}
          overlayBottomOffset={isWeb ? webOverlayOffset : 84}
          header={
            !isVoiceMode && translateOptions.length > 0 ? (
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
                  <LolaVoiceButton lolaReply={item?.content} />
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
            {isVoiceMode ? (
              <View className="mb-3 px-1">
                <VoiceRecorderButton
                  state={voiceConversation.state}
                  durationMs={voiceConversation.durationMs}
                  transcript={voiceConversation.lastTranscript}
                  error={voiceConversation.error}
                  languageLabel={languageMeta.label}
                  isSupported={voiceConversation.isSupported}
                  onStart={voiceConversation.startRecording}
                  onStop={voiceConversation.stopRecording}
                  onCancel={voiceConversation.cancelRecording}
                />
              </View>
            ) : null}

            {isVoiceMode ? (
              <Text className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Prefer typing instead? That works too.
              </Text>
            ) : null}

            <View className="flex-row items-end gap-2 px-1">
              <View className="flex-1">
                <LolaChatInput
                  value={text}
                  onChangeText={setText}
                  onSend={() => sendRef.current?.send?.()}
                  placeholder={
                    isVoiceMode
                      ? `Type a sentence if you would rather not use voice. Lola will answer in ${languageMeta.label}.`
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

              {!isVoiceMode ? (
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
              ) : null}

              <SendButton
                ref={sendRef}
                text={text}
                setText={setText}
                messages={messages}
                setMessages={(updater: any) => {
                  // Keep existing SendButton behavior, but if it appends a user message,
                  // we attach the profile name (used for future personalization/UI).
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
                label={isVoiceMode ? 'Send text' : undefined}
              />
            </View>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
