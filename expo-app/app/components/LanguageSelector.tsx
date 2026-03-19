import { useState } from 'react';
import {
  Text,
  TouchableOpacity,
  View,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import {
  LANGUAGE_OPTIONS,
  getLanguageMeta,
  type AppLanguage,
} from '../lib/languages';

type Props = {
  language: AppLanguage;
  onChange: (language: AppLanguage) => void;
  title?: string;
  subtitle?: string;
  compact?: boolean;
};

export default function LanguageSelector({
  language,
  onChange,
  title,
  subtitle,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const current = getLanguageMeta(language);

  return (
    <>
      {/* Compact chip trigger */}
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        className="flex-row items-center self-start rounded-full border border-violet-200 bg-violet-50 px-3 py-2"
      >
        <View className="mr-2 h-2 w-2 rounded-full bg-violet-500" />
        <Text className="text-sm font-semibold text-violet-800">
          {current.label}
        </Text>
        <Text className="ml-1 text-xs text-violet-400">
          {current.nativeLabel}
        </Text>
        <Text className="ml-2 text-xs text-violet-400">▾</Text>
      </TouchableOpacity>

      {/* Dropdown modal */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.3)',
            justifyContent: 'flex-start',
            paddingTop: Platform.OS === 'web' ? 100 : 120,
            paddingHorizontal: 16,
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="rounded-2xl bg-white shadow-lg"
            style={{
              maxWidth: 400,
              width: '100%',
              alignSelf: 'center',
              ...(Platform.OS === 'web'
                ? { boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }
                : {}),
            }}
          >
            <View className="px-4 pt-4 pb-2">
              <Text className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                Choose language
              </Text>
            </View>

            <View className="px-2 pb-3">
              {LANGUAGE_OPTIONS.map((option) => {
                const active = option.code === language;
                return (
                  <TouchableOpacity
                    key={option.code}
                    onPress={() => {
                      onChange(option.code);
                      setOpen(false);
                    }}
                    activeOpacity={0.7}
                    className={`mx-1 my-0.5 flex-row items-center rounded-xl px-3 py-3 ${
                      active ? 'bg-violet-100' : ''
                    }`}
                  >
                    {active && (
                      <Text className="mr-2 text-violet-600">✓</Text>
                    )}
                    <Text
                      className={`text-base ${
                        active
                          ? 'font-bold text-violet-800'
                          : 'font-medium text-gray-800'
                      }`}
                    >
                      {option.label}
                    </Text>
                    <Text className="ml-2 text-sm text-gray-400">
                      {option.nativeLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
