import { View, Text } from 'react-native';

export default function ChatBubble({ author, text }:{author:string,text:string}){
  const isUser = author === 'user' || author === 'me';
  // Assistant: translucent glass; User: solid brand pill
  if (isUser) {
    return (
      <View className="max-w-[85%] p-3 rounded-2xl bg-brand-600 self-end shadow-lg">
        <Text className="text-white">{text}</Text>
      </View>
    );
  }
  return (
    <View className="max-w-[85%] p-3 rounded-2xl bg-white/10 border border-white/15">
      <Text className="text-white/90">{text}</Text>
    </View>
  );
}
