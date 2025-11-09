import { View, TextInput, TouchableOpacity, Text } from 'react-native';

export default function MessageInput({ value, onChange, onSend, placeholder }:{value:string,onChange:(s:string)=>void,onSend:()=>void,placeholder?:string}){
  return (
    <View className="flex-row items-center px-4 py-3 bg-white/6 border border-white/10 rounded-2xl">
      <TextInput
        className="flex-1 text-white px-2"
        value={value}
        onChangeText={onChange}
        placeholder={placeholder||'Type...'}
        placeholderTextColor="rgba(255,255,255,0.6)"
      />
      <TouchableOpacity onPress={onSend} className="ml-3 bg-brand-600 rounded-full px-4 py-2 shadow-lg">
        <Text className="text-white font-semibold">Send</Text>
      </TouchableOpacity>
    </View>
  );
}
