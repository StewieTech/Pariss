import { Text, TouchableOpacity } from 'react-native';
import client from '../lib/client';
import { API } from '../lib/config';

// Option 1: pure utility function (no hooks). Caller manages state.
export async function translateFirst(text: string): Promise<string[]> {
  if (!text) return [];
  const res = await client.post(`${API}/chat/translate`, { text });
  const variants: string[] = res?.data?.variants ?? [];
  return Array.isArray(variants) ? variants : [];
}

type TranslateButtonProps = {
  title?: string;
  loadingTitle?: string;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  className?: string;
};

export function TranslateButton({
  title = 'Translate',
  loadingTitle = 'Translating...',
  loading,
  disabled,
  onPress,
  className = '',
}: TranslateButtonProps) {
  const isDisabled = Boolean(disabled) || Boolean(loading);

  return (
    <TouchableOpacity
      onPress={isDisabled ? undefined : onPress}
      activeOpacity={isDisabled ? 1 : 0.85}
      className={`px-4 py-3 rounded-2xl items-center justify-center border ${
        isDisabled
          ? 'bg-gray-100 border-gray-200'
          : 'bg-white border-violet-200'
      } ${className}`}
    >
      <Text
        className={`text-sm font-semibold ${
          isDisabled ? 'text-gray-500' : 'text-violet-700'
        }`}
      >
        {loading ? loadingTitle : title}
      </Text>
    </TouchableOpacity>
  );
}