import { useRef, useState } from 'react';
import SendButton from '../components/SendButton';
import { sanitizeVariant } from '../lib/utils';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LolaVoiceButton } from '../components/LolaVoiceButton';
import { translateFirst, TranslateButton } from '../components/TranslateButton';
import { LolaChatInput } from '../components/LolaChatInput';
import ModeToggle from '../components/ModeToggle';
import ChatBubble from '../components/ChatBubble';

const COMPOSER_HEIGHT = 92; // tweak if needed

export default function PvEScreen() {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const sendRef = useRef<{ send?: () => void } | null>(null);
  const [mode, setMode] = useState<'m1'|'m2'|'m3'>('m1');
  const [translateOptions, setTranslateOptions] = useState<string[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);

  const isWeb = Platform.OS === 'web';

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
            onChange={setMode}
            items={[
              { label: 'm1: LolaChat', value: 'm1' },
              { label: 'm3: $ LolaVoice', value: 'm3' },
            ]}
          />
        </View>

        {/* List */}
        <View className="flex-1">
          <FlatList
            data={messages}
            keyExtractor={(i, idx) => String(idx)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingBottom: isWeb ? COMPOSER_HEIGHT + 16 : 12,
            }}
            ListHeaderComponent={
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
                    <LolaVoiceButton lolaReply={item?.content} />
                  ) : null
                }
              />
            )}
          />
        </View>

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
            <View className="flex-row items-end gap-2 px-1">
              <View className="flex-1">
                <LolaChatInput
                  value={text}
                  onChangeText={setText}
                  onSend={() => sendRef.current?.send?.()}
                  placeholder="Ask Lola Anything :)"
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
                    const variants = await translateFirst(text);
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
                setMessages={setMessages}
                mode={mode}
              />
            </View>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
