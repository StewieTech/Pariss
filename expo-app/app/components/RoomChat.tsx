// components/RoomChat.tsx
import React, { useRef, useState } from 'react';
import { View, Text, FlatList, Button, TouchableOpacity } from 'react-native';
import { LolaChatInput } from './LolaChatInput';
import styles from '../styles';
import { sanitizeVariant } from '../lib/sanitize';
import * as api from '../lib/api';

export type RoomChatMessage = {
  name: string;
  text: string;
};

export type RoomChatProps = {
  roomId: string;
  participants: string[];
  messages: RoomChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<RoomChatMessage[]>>; // kept for future if you want optimistic updates
  onSend: (text: string) => Promise<void> | void;
  onLeave: () => void;
  currentUserName?: string; // optional; lets us style "my" messages differently
};

export default function RoomChat({
  roomId,
  participants,
  messages,
  setMessages, // eslint-disable-line @typescript-eslint/no-unused-vars
  onSend,
  onLeave,
  currentUserName,
}: RoomChatProps) {
  const [text, setText] = useState('');
  const [translateOptions, setTranslateOptions] = useState<string[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  // Prevent duplicate sends from Enter + button press in quick succession
  const sendingRef = useRef(false);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleSend() {
    const t = text.trim();
    if (!t) return;
    if (sendingRef.current) return; // immediate lock
    sendingRef.current = true;
    setIsSending(true);
    try {
      await onSend(t);
      setText('');
    } finally {
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
      cooldownRef.current = setTimeout(() => {
        sendingRef.current = false;
        setIsSending(false);
        cooldownRef.current = null;
      }, 600);
    }
  }

  async function handleTranslateFirst() {
    if (!text) return;
    setIsTranslating(true);
    setTranslateOptions([]);
    try {
      const r = await api.translateFirst(text);
      const variants: string[] = r?.variants ?? [];
      setTranslateOptions(variants.slice(0, 3));
    } catch (e) {
      console.error('translateFirst failed', e);
      setTranslateOptions([`(translation failed) ${String(e)}`]);
    } finally {
      setIsTranslating(false);
    }
  }

  return (
    <View className="absolute inset-0 bg-white px-3 py-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-lg font-semibold text-gray-900">
          Room {roomId}
        </Text>
        <Text className="text-sm text-gray-700">
          Participants:{' '}
          {Array.isArray(participants) ? participants.length : 0}
        </Text>
      </View>

      {/* Messages list - inline bubbles like PvE */}
      <FlatList
        data={messages}
        keyExtractor={(item, index) => `${roomId}-${index}`}
        style={{ flex: 1, marginBottom: 12 }}
        renderItem={({ item }) => {
          const isUser =
            currentUserName && item.name === currentUserName;
          const bubbleStyle = isUser ? styles.userBubble : styles.assistantBubble;

          return (
            <View style={[styles.bubble, bubbleStyle]}>
              {/* Show sender name so it's clear who is who */}
              <Text style={{ fontWeight: '600', marginBottom: 4 }}>
                {item.name || 'Anonymous'}
              </Text>
              <Text>{item.text}</Text>
            </View>
          );
        }}
      />

      {/* Input row: same layout idea as PvE */}
      <View style={styles.inputRow}>
        <LolaChatInput
          value={text}
          onChangeText={setText}
          onSend={handleSend}
          placeholder="Type your messages"
          inputStyle={styles.input}
        />

        <View style={{ flexDirection: 'row' }}>
          <View style={{ marginRight: 6 }}>
            <Button
              title={isTranslating ? 'Translating...' : 'Translate First'}
              onPress={handleTranslateFirst}
              disabled={isTranslating}
            />
          </View>

          <Button title={isSending ? 'Sending...' : 'Send'} onPress={handleSend} disabled={isSending} />
        </View>
      </View>

      {/* Translation choices, like PvE */}
      {translateOptions.length > 0 && (
        <View style={styles.translatePanel}>
          <Text style={{ fontWeight: '600', marginBottom: 6 }}>
            Choose a translation
          </Text>
          {translateOptions.map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => {
                setText(sanitizeVariant(opt));
                setTranslateOptions([]);
              }}
              style={styles.translateOption}
            >
              <Text>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Leave button under the input row + translate panel */}
      <View className="flex-row mt-3">
        <Text
          className="px-3 py-2 rounded-lg bg-rose-500 text-white font-semibold"
          onPress={onLeave}
        >
          Leave Room
        </Text>
      </View>
    </View>
  );
}
