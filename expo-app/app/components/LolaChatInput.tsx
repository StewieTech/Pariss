// components/LolaChatInput.tsx
import React from 'react';
import { Platform, TextInput, TextInputProps } from 'react-native';

export type LolaChatInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  placeholder?: string;
  inputStyle?: TextInputProps['style'];
};

export function LolaChatInput({
  value,
  onChangeText,
  onSend,
  placeholder = 'Type...',
  inputStyle,
}: LolaChatInputProps) {
  // web-specific keyboard handler props (onKeyDown isn't part of RN TextInputProps types)
  const webKeyDownProps: any =
    Platform.OS === 'web'
      ? {
          onKeyDown: (e: any) => {
            const key = e?.key ?? e?.nativeEvent?.key;
            const shift = e?.shiftKey ?? e?.nativeEvent?.shiftKey;
            const alt = e?.altKey ?? e?.nativeEvent?.altKey;
            const ctrl = e?.ctrlKey ?? e?.nativeEvent?.ctrlKey;
            const meta = e?.metaKey ?? e?.nativeEvent?.metaKey;

            if (key === 'Enter') {
              // only treat Enter as send when no modifier keys are pressed
              if (shift || alt || ctrl || meta) {
                // allow newline when any modifier is used
                return;
              }
              if (e.preventDefault) e.preventDefault();
              onSend();
            }
          },
        }
      : {};

  return (
    <TextInput
      style={inputStyle}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      multiline={true}
      blurOnSubmit={true}
      returnKeyType="send"
      onSubmitEditing={onSend}
      {...webKeyDownProps}
      onKeyPress={(e: any) => {
        // fallback for platforms that expose nativeEvent.key
        try {
          const key = e?.nativeEvent?.key;
          const shift = e?.nativeEvent?.shiftKey;
          const alt = e?.nativeEvent?.altKey;
          const ctrl = e?.nativeEvent?.ctrlKey;
          const meta = e?.nativeEvent?.metaKey;
          if (key === 'Enter' && !shift && !alt && !ctrl && !meta) {
            onSend();
          }
        } catch {
          // ignore
        }
      }}
    />
  );
}
