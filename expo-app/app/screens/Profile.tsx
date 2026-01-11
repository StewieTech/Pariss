import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import GlassWrapper from '../components/GlassWrapper';
import { GradientButton } from '../components/GradientButton';
import { useAuth } from '../lib/auth';
import { API } from '../lib/config';

const genders = [
  { key: 'prefer_not_to_say', label: 'Prefer not to say' },
  { key: 'female', label: 'Female' },
  { key: 'male', label: 'Male' },
  { key: 'nonbinary', label: 'Non-binary' },
] as const;

export default function ProfileScreen({ onDone }: { onDone: () => void }) {
  const { user, updateProfile, uploadPhoto, logout } = useAuth();

  const initial = useMemo(() => user?.profile || {}, [user]);

  const [name, setName] = useState(initial.name || '');
  const [location, setLocation] = useState(initial.location || '');
  const [learningLanguage, setLearningLanguage] = useState(initial.learningLanguage || '');
  const [gender, setGender] = useState(
    (initial.gender as any) || 'prefer_not_to_say'
  );

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const photoUrl = user?.profile?.photoUrl
    ? (user.profile.photoUrl.startsWith('http')
        ? user.profile.photoUrl
        : `${API.replace(/\/$/, '')}${user.profile.photoUrl}`)
    : null;

  const dirty =
    name !== (initial.name || '') ||
    location !== (initial.location || '') ||
    learningLanguage !== (initial.learningLanguage || '') ||
    gender !== ((initial.gender as any) || 'prefer_not_to_say');

  async function pickPhoto() {
    setError(null);

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Permission to access photos is required');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });

    if (result.canceled) return;

    const uri = result.assets?.[0]?.uri;
    if (!uri) return;

    setSaving(true);
    try {
      await uploadPhoto(uri);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    setError(null);
    const n = name.trim();
    if (n.length < 2) return setError('Name must be at least 2 characters');

    setSaving(true);
    try {
      await updateProfile({
        name: n,
        location: location.trim() || undefined,
        learningLanguage: learningLanguage.trim() || undefined,
        gender: gender as any,
      });
      onDone();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <GlassWrapper className="px-6">
        <View className="flex-1 justify-center">
          <Text className="text-white text-lg">You need to log in first.</Text>
          <TouchableOpacity onPress={onDone} className="mt-4 bg-white/10 border border-white/15 px-5 py-3 rounded-2xl">
            <Text className="text-white font-semibold text-center">Back</Text>
          </TouchableOpacity>
        </View>
      </GlassWrapper>
    );
  }

  return (
    <GlassWrapper className="px-6">
      <View className="flex-1 justify-center">
        <Text className="text-2xl font-semibold text-white mb-4">Your Profile</Text>

        <View className="items-center mb-4">
          <View className="w-24 h-24 rounded-full bg-white/10 overflow-hidden items-center justify-center border border-white/15">
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} className="w-24 h-24" />
            ) : (
              <Text className="text-white font-bold text-xl">
                {(user.profile?.name || user.email || '?').slice(0, 1).toUpperCase()}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={pickPhoto} disabled={saving} className="mt-3 px-4 py-2 rounded-xl bg-white/10 border border-white/15">
            <Text className="text-white font-semibold">{saving ? 'Uploading…' : 'Upload photo'}</Text>
          </TouchableOpacity>
          {Platform.OS === 'web' && (
            <Text className="text-white/70 text-xs mt-1">(Web uploads depend on browser support)</Text>
          )}
        </View>

        <View className="gap-3">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Name"
            className="bg-white/10 border border-white/15 rounded-2xl px-4 py-3 text-white"
            placeholderTextColor="rgba(255,255,255,0.7)"
          />

          <View className="flex-row flex-wrap gap-2">
            {genders.map((g) => {
              const active = gender === g.key;
              return (
                <TouchableOpacity
                  key={g.key}
                  onPress={() => setGender(g.key)}
                  className={[
                    'px-3 py-2 rounded-xl border',
                    active ? 'bg-white border-white' : 'bg-white/10 border-white/15',
                  ].join(' ')}
                >
                  <Text className={active ? 'text-brand-600 font-semibold' : 'text-white'}>{g.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Location (optional)"
            className="bg-white/10 border border-white/15 rounded-2xl px-4 py-3 text-white"
            placeholderTextColor="rgba(255,255,255,0.7)"
          />

          <TextInput
            value={learningLanguage}
            onChangeText={setLearningLanguage}
            placeholder="Language you're learning (optional)"
            className="bg-white/10 border border-white/15 rounded-2xl px-4 py-3 text-white"
            placeholderTextColor="rgba(255,255,255,0.7)"
          />

          {error && <Text className="text-red-200">{error}</Text>}

          <GradientButton
            title={saving ? 'Saving…' : 'Save'}
            onPress={save}
          />

          <TouchableOpacity
            onPress={async () => {
              await logout();
              onDone();
            }}
            className="rounded-2xl px-6 py-4 bg-white/10 border border-white/15"
            disabled={saving}
          >
            <Text className="text-white font-semibold text-center">Logout</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onDone}
            className="rounded-2xl px-6 py-4 bg-white/5 border border-white/10"
            disabled={saving}
          >
            <Text className="text-white/90 font-semibold text-center">Back</Text>
          </TouchableOpacity>

          <Text className="text-white/70 text-xs mt-2">
            Tip: Set your name and it will be used in PvP and PvE.
          </Text>
        </View>
      </View>
    </GlassWrapper>
  );
}
