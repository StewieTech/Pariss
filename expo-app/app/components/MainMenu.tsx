// app/components/MainMenu.tsx
import { View, Text, TouchableOpacity } from 'react-native';
import GlassWrapper from './GlassWrapper';
import { GradientButton } from './GradientButton';
import { useAuth } from '../lib/auth';

export default function MainMenu({ onChoose }: { onChoose: (s: any) => void }) {
  const { isLoggedIn, hasProfileName, user } = useAuth();

  return (
    <GlassWrapper className="px-6">
      <View className="flex-1 items-center justify-center">
        <View className="w-full max-w-md">
          <Text className="text-2xl font-semibold text-white mb-1">
            Practice Your Language With LolaInParis or With A Friend :)
          </Text>

          {isLoggedIn && hasProfileName ? (
            <Text className="text-white/80 mb-3">Welcome, {user?.profile?.name}.</Text>
          ) : (
            <View className="mb-4 rounded-2xl bg-white/10 border border-white/15 p-4">
              <Text className="text-white font-semibold mb-1">Create your profile</Text>
              <Text className="text-white/80 mb-3">
                Log in to save your name and photo, and use the same identity in PvP and PvE.
              </Text>
              <TouchableOpacity
                onPress={() => onChoose('auth')}
                className="rounded-2xl px-5 py-3 bg-white/15 border border-white/20"
              >
                <Text className="text-white font-semibold text-center">
                  {isLoggedIn ? 'Finish Profile' : 'Login / Create Account'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

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
