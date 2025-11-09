// app/components/NavBar.tsx
import { View, Text, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
const BV: any = BlurView;

export default function NavBar({ current, onNav }: { current: string; onNav: (s: any) => void }) {
  const tab = (key: string, label: string) => {
    const active = current === key;
    return (
      <TouchableOpacity
        key={key}
        testID={`nav-${key}`}
        onPress={() => onNav(key)}
        className={`flex-1 mx-1 py-3 rounded-2xl items-center justify-center ${
          active ? 'bg-white text-brand-600' : 'bg-white/10'
        }`}
      >
        <Text className={`text-lg font-bold ${active ? 'text-brand-600' : 'text-white'}`}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    // big bubbly purple nav with three evenly spaced options
    <BV intensity={30} tint="dark" className="mx-3 mt-3 rounded-2xl overflow-hidden bg-brand-600">
<View className="flex-row items-center justify-around px-3 py-3">
        {tab('main', 'Main')}
        {tab('pve', 'Talk to Lola')}
        {tab('pvp', 'Talk to Friends')}
      </View>
    </BV>
  );
}
