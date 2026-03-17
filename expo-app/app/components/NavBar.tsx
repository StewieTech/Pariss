// app/components/NavBar.tsx
import { View, Text, TouchableOpacity, Modal, Pressable, Image } from 'react-native';
import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { API } from '../lib/config';
const BV: any = BlurView;

export default function NavBar({
  current,
  onNav,
}: {
  current: string;
  onNav: (s: any) => void;
}) {
  const { user, isLoggedIn, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

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
        <View className="flex-1 flex-row items-center gap-2">
          {tab('main', 'Main')}
          {tab('pve', 'Talk to Lola')}
          {tab('pvp', 'Talk to Friends')}
        </View>

        {/* Right-side profile/login */}
        <TouchableOpacity
          testID="nav-profile"
          onPress={() => setMenuOpen(true)}
          className="px-3 py-2 rounded-2xl bg-white/10 border border-white/15"
          activeOpacity={0.85}
        >
          {isLoggedIn ? (
            <View className="flex-row items-center gap-2">
              {user?.profile?.photoUrl ? (
                <Image
                  source={{
                    uri: user.profile.photoUrl.startsWith('http')
                      ? user.profile.photoUrl
                      : `${API.replace(/\/$/, '')}${user.profile.photoUrl}`,
                  }}
                  style={{ width: 22, height: 22, borderRadius: 11 }}
                />
              ) : (
                <View
                  style={{ width: 22, height: 22, borderRadius: 11 }}
                  className="bg-white/20 items-center justify-center"
                >
                  <Text className="text-white text-xs font-bold">
                    {(user?.profile?.name || user?.email || '?').slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text className="text-white font-semibold" numberOfLines={1}>
                {user?.profile?.name ? user.profile.name : 'Profile'}
              </Text>
            </View>
          ) : (
            <Text className="text-white font-semibold">Login</Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable className="flex-1" onPress={() => setMenuOpen(false)}>
          <View className="flex-1" />
        </Pressable>
        <View className="mx-6 mb-8 rounded-2xl overflow-hidden bg-black/70 border border-white/15">
          {isLoggedIn ? (
            <>
              <TouchableOpacity
                onPress={() => {
                  setMenuOpen(false);
                  onNav('profile');
                }}
                className="px-5 py-4"
              >
                <Text className="text-white font-semibold">View Profile</Text>
              </TouchableOpacity>
              <View className="h-px bg-white/10" />
              <TouchableOpacity
                onPress={async () => {
                  setMenuOpen(false);
                  await logout();
                  onNav('main');
                }}
                className="px-5 py-4"
              >
                <Text className="text-white font-semibold">Logout</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => {
                  setMenuOpen(false);
                  onNav('auth');
                }}
                className="px-5 py-4"
              >
                <Text className="text-white font-semibold">Login</Text>
              </TouchableOpacity>
              <View className="h-px bg-white/10" />
              <TouchableOpacity
                onPress={() => {
                  setMenuOpen(false);
                  onNav('auth');
                }}
                className="px-5 py-4"
              >
                <Text className="text-white font-semibold">Create Profile</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </BV>
  );
}
