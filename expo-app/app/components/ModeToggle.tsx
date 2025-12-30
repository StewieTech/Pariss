import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export type ModeToggleItem<T extends string> = {
  label: string;
  value: T;
};

export type ModeToggleProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  items: ReadonlyArray<ModeToggleItem<T>>;
  className?: string;
};

/**
 * Shared PvE-style mode toggle.
 *
 * Intended to match the pill buttons used in `PvE.tsx`.
 */
export default function ModeToggle<T extends string>({
  value,
  onChange,
  items,
  className,
}: ModeToggleProps<T>) {
  return (
    <View className={`flex-row mt-2 flex-wrap ${className ?? ''}`.trim()}>
      {items.map((mb) => (
        <TouchableOpacity
          key={mb.label}
          onPress={() => onChange(mb.value)}
          className={`px-3 py-2 rounded-full mr-2 border ${
            value === mb.value
              ? 'bg-violet-600 border-violet-600'
              : 'bg-white border-gray-300'
          }`}
          activeOpacity={0.85}
        >
          <Text
            className={`text-sm font-semibold ${
              value === mb.value ? 'text-white' : 'text-gray-800'
            }`}
          >
            {mb.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
