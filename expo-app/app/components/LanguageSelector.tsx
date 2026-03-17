import { Text, TouchableOpacity, View } from 'react-native';
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
  title = 'Learning language',
  subtitle = 'Lola will reply and guide you in this language.',
  compact = false,
}: Props) {
  const current = getLanguageMeta(language);

  return (
    <View
      className={`rounded-3xl border border-violet-200 bg-violet-50 ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            {title}
          </Text>
          <Text className="mt-1 text-lg font-semibold text-gray-900">
            {current.label}
          </Text>
          <Text className="mt-1 text-sm text-gray-600">{subtitle}</Text>
        </View>

        <View className="rounded-2xl border border-violet-200 bg-white px-3 py-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-violet-500">
            Active
          </Text>
          <Text className="text-sm font-semibold text-violet-800">
            {current.nativeLabel}
          </Text>
        </View>
      </View>

      <View className="mt-4 flex-row flex-wrap gap-2">
        {LANGUAGE_OPTIONS.map((option) => {
          const active = option.code === language;
          return (
            <TouchableOpacity
              key={option.code}
              onPress={() => onChange(option.code)}
              activeOpacity={0.85}
              className={`rounded-full border px-3 py-2 ${
                active
                  ? 'border-violet-700 bg-violet-700'
                  : 'border-violet-200 bg-white'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  active ? 'text-white' : 'text-violet-800'
                }`}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
