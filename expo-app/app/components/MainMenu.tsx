// app/components/MainMenu.tsx
import { View, Text, TouchableOpacity } from 'react-native';
import GlassWrapper from './GlassWrapper';
import { GradientButton } from './GradientButton';

export default function MainMenu({ onChoose }: { onChoose: (s: any) => void }) {
  return (
    <GlassWrapper className="px-6">
      <View className="flex-1 items-center justify-center">
        <View className="w-full max-w-md">
          <Text className="text-2xl font-semibold text-white mb-1">Practice Your Language With LolaInParis or With A Friend :) </Text>
          <Text className="text-white/80 mb-5">Pick a mode</Text>

          <View className="gap-4">
            <GradientButton title="Talk to Lola" onPress={() => onChoose('pve')} />

            <TouchableOpacity
              onPress={() => onChoose('pvp')}
              className="rounded-2xl px-6 py-4 bg-white/10 border border-white/15"
            >
              <Text className="text-white font-semibold text-center">Talk to Friends</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </GlassWrapper>
  );
}
