// app/components/NavBar.tsx
import { View, Text, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
const BV: any = BlurView;

export default function NavBar({
  current,
  onNav,
}: {
  current: string;
  onNav: (s: any) => void;
}) {
  const tab = (key: string, label: string) => {
    const active = current === key;

    return (
      <TouchableOpacity
        key={key}
        testID={`nav-${key}`}
        onPress={() => onNav(key)}
        className={[
          // ✅ force equal width
          'flex-1 min-w-0',
          // ✅ shape + spacing
          'px-3 py-3 rounded-2xl items-center justify-center',
          // ✅ active/inactive bg
          active ? 'bg-white' : 'bg-white/10',
        ].join(' ')}
        activeOpacity={0.85}
      >
        <Text
          className={[
            // Slightly smaller + allow shrink so long labels ("Talk to Friends") fit.
            'text-center text-sm font-bold',
            active ? 'text-brand-600' : 'text-white',
          ].join(' ')}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <BV
      intensity={30}
      tint="dark"
      className="mx-3 mt-2 rounded-2xl overflow-hidden bg-brand-600"
    >
      {/* ✅ w-full + gap + no justify-center */}
      <View className="w-full flex-row items-center gap-2 px-3 py-2">
        {tab('main', 'Main')}
        {tab('pve', 'Talk to Lola')}
        {tab('pvp', 'Talk to Friends')}
      </View>
    </BV>
  );
}
