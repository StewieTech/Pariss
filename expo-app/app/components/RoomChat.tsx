// components/RoomChat.tsx
import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { LolaChatInput } from './LolaChatInput';
import { sanitizeVariant } from '../lib/sanitize';
import { translateFirst, TranslateButton } from './TranslateButton';
import ModeToggle from './ModeToggle';
import ChatBubble from './ChatBubble';
import { LolaVoiceButton } from './LolaVoiceButton';
import ChatMessageList from './ChatMessageList';

const COMPOSER_HEIGHT = 92; // keep consistent with PvE

export type RoomChatMessage = {
  name: string;
  text: string;
};

export type RoomChatProps = {
  roomId: string;
  participants: string[];
  messages: RoomChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<RoomChatMessage[]>>; // kept for future if you want optimistic updates
  onSend: (text: string, opts: { includeLola: boolean; mode: 'm1' | 'm2' | 'm3' }) => Promise<void> | void;
  onLeave: () => void;
  currentUserName?: string; // optional; lets us style "my" messages differently
};

type Mode = 'm1' | 'm2' | 'm3';

export default function RoomChat({
  roomId,
  participants,
  messages,
  setMessages,
  onSend,
  onLeave,
  currentUserName,
}: RoomChatProps) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<Mode>('m2');
  const [translateOptions, setTranslateOptions] = useState<string[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);

  // Prevent duplicate sends from Enter + button press in quick succession
  const sendingRef = useRef(false);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSending, setIsSending] = useState(false);

  const isWeb = Platform.OS === 'web';

  async function handleTranslateFirst() {
    if (!text) return;
    setIsTranslating(true);
    setTranslateOptions([]);
    try {
      const variants = await translateFirst(text);
      setTranslateOptions(variants.length ? variants.slice(0, 3) : ['(no variants)']);
    } catch (e) {
      console.error('translateFirst failed', e);
      setTranslateOptions([`(translation failed) ${String(e)}`]);
    } finally {
      setIsTranslating(false);
    }
  }

  // Send behavior: per choice B, RoomChat send should go to OpenAI (like PvE) in m1/m3.
  // In Option A, the client posts to the room endpoint and the server persists BOTH the user
  // message and Lola's reply. RoomChat should therefore call `onSend` (room send) and rely on
  // polling/state from the parent to display messages.

  async function handleSend() {
    const t = text.trim();
    if (!t) return;
    if (sendingRef.current) return;
    sendingRef.current = true;
    setIsSending(true);
    try {
      await Promise.resolve(onSend(t, { includeLola: true, mode }));
      setText('');
    } finally {
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
      cooldownRef.current = setTimeout(() => {
        sendingRef.current = false;
        setIsSending(false);
        cooldownRef.current = null;
      }, 800);
    }
  }

  return (
    <View className="absolute inset-0 z-50 bg-white">
      <View className="flex-1 w-full self-center max-w-3xl px-3">
        {/* Header */}
        <View className="mb-3 pt-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-gray-900">Room {roomId}</Text>
            <Text className="text-sm text-gray-700">
              Participants: {Array.isArray(participants) ? participants.length : 0}
            </Text>
          </View>

          <ModeToggle<Mode>
            value={mode}
            onChange={setMode}
            items={[
              // { label: 'm1: LolaChat', value: 'm1' },
              { label: 'm1: LolaChat', value: 'm1' },
              { label: 'm2: TranslateOnly', value: 'm2' },
              { label: 'm3: $ LolaVoice', value: 'm3' },
            ]}
          />

          <View className="flex-row mt-2">
            <Text
              className="px-3 py-2 rounded-full bg-rose-500 text-white font-semibold"
              onPress={onLeave}
            >
              Leave Room
            </Text>
          </View>
        </View>

        {/* List */}
        <ChatMessageList<RoomChatMessage>
          data={messages}
          keyExtractor={(item, index) => `${roomId}-${index}`}
          bottomPadding={isWeb ? COMPOSER_HEIGHT + 16 : 12}
          overlayBottomOffset={isWeb ? COMPOSER_HEIGHT + 28 : 84}
          header={
            translateOptions.length > 0 ? (
              <View className="p-3 mb-3 rounded-2xl bg-amber-50 border border-amber-200">
                <Text className="font-semibold text-amber-900 mb-2">Choose a translation</Text>
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
          renderItem={({ item }) => {
              const isUser = Boolean(currentUserName && item.name === currentUserName);
              const isLola = String(item.name || '').toLowerCase() === 'lola';

              // Requested: in m2, only Lola responses should be renamed to
              // "<currentUserName> | Translate". Don't rename other participants.
              const displayName =
                !isUser && mode === 'm2' && isLola
                  ? `${currentUserName || 'Me'} | Translate`
                  : item.name;

              return (
                <ChatBubble
                  role={isUser ? 'user' : 'assistant'}
                  content={item.text}
                  name={displayName}
                  variant={!isUser && isLola ? 'lola' : 'default'}
                  footer={
                    !isUser && mode === 'm3' ? (
                      <LolaVoiceButton lolaReply={item.text} />
                    ) : null
                  }
                />
              );
            }}
        />

        {/* Composer */}
        <View
          style={
            isWeb
              ? ({
                  position: 'fixed',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'white',
                  borderTopWidth: 1,
                  borderTopColor: '#e5e7eb',
                  // paddingTop: 8,
                  paddingBottom: 16,
                  paddingLeft: 12,
                  paddingRight: 12,
                } as any)
              : {}
          }
          className={!isWeb ? 'border-t border-gray-200 bg-white pt-2 pb-4' : ''}
        >
          <View className={isWeb ? 'w-full self-center max-w-3xl' : ''}>
            <View className="flex-row items-end gap-2 px-1">
              <View className="flex-1">
                <LolaChatInput
                  value={text}
                  onChangeText={setText}
                  onSend={handleSend}
                  placeholder="Type your messages"
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
                onPress={handleTranslateFirst}
              />

              <TouchableOpacity
                onPress={isSending || !text ? undefined : handleSend}
                activeOpacity={isSending || !text ? 1 : 0.85}
                className={`px-4 py-3 rounded-2xl items-center justify-center ${
                  isSending || !text
                    ? 'bg-gray-200 border border-gray-200'
                    : 'bg-violet-600'
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    isSending || !text ? 'text-gray-600' : 'text-white'
                  }`}
                >
                  {isSending ? 'Sending...' : 'Send'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
