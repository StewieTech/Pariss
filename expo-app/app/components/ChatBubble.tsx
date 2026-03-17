import React from 'react';
import { Text, View } from 'react-native';

export type ChatBubbleRole = 'user' | 'assistant';

type Props = {
  /**
   * Preferred: PvE-style messages.
   */
  role?: ChatBubbleRole;
  content?: string;

  /**
   * Back-compat: older callers.
   */
  author?: string;
  text?: string;

  /** Optional name label shown above the message. */
  name?: string;

  /** Optional footer row (e.g. voice button). */
  footer?: React.ReactNode;

  /**
   * Optional style variant for assistant bubbles.
   * - default: current PvE styling
   * - lola: even subtler purple for Lola responses
   */
  variant?: 'default' | 'lola';
};

/**
 * Shared chat bubble.
 *
 * Default styling matches the bubbles in `PvE.tsx`.
 */
export default function ChatBubble({ role, content, author, text, name, footer, variant }: Props) {
  const resolvedRole: ChatBubbleRole =
    role ?? ((author === 'user' || author === 'me') ? 'user' : 'assistant');
  const resolvedText = content ?? text ?? '';

  const isUser = resolvedRole === 'user';

  // If this bubble is an assistant bubble, allow callerj to opt into a subtler
  // purple palette specifically for Lola responses.
  const assistantClassName =
    variant === 'lola'
      ? 'bg-violet-50/40 border-violet-100/60'
      : 'bg-violet-50 border-violet-200';

  return (
    <View
      className={`max-w-[85%] rounded-2xl px-3 py-2 mb-2 ${
        isUser
          ? 'self-end bg-violet-600'
          : `self-start border ${assistantClassName}`
      }`}
    >
      {name ? (
        <Text
          className={
            isUser
              ? 'text-white/90 text-xs font-semibold mb-1'
              : 'text-gray-700 text-xs font-semibold mb-1'
          }
        >
          {name}
        </Text>
      ) : null}

      <Text className={isUser ? 'text-white' : 'text-gray-900'}>{resolvedText}</Text>

      {footer ? <View className="mt-2">{footer}</View> : null}
    </View>
  );
}
