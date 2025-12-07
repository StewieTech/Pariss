import React, { useState } from 'react';
import { View, Text, FlatList, TextInput } from 'react-native';
import ChatBubble from './ChatBubble';
import SendButton from './SendButton';

export type RoomChatProps = {
  roomId: string;
  participants: string[];
  messages: Array<{ name: string; text: string }>;
  onSend: (text: string) => Promise<void> | void;
  onLeave: () => void;
};

export default function RoomChat({ roomId, participants, messages, onSend, onLeave }: RoomChatProps) {
  const [text, setText] = useState('');

  return (
    <View className="absolute inset-0 bg-white px-3 py-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-lg font-semibold text-gray-900">Room {roomId}</Text>
        <Text className="text-sm text-gray-700">Participants: {Array.isArray(participants) ? participants.length : 0}</Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(m, i) => `${roomId}-${i}`}
        className="flex-1 mb-3"
        renderItem={({ item }) => <ChatBubble author={item.name} text={item.text} />}
      />

      <TextInput
        className="border border-gray-300 rounded-md px-3 py-2 mb-2"
        value={text}
        onChangeText={setText}
        placeholder="Type your message"
      />

      <SendButton
        text={text}
        setText={setText}
        messages={messages as any}
        setMessages={() => { /* PvP messages managed by hook; optimistic handled in onSend */ }}
        onSend={async (t) => {
          if (!t) return;
          await onSend(t);
        }}
      />

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
