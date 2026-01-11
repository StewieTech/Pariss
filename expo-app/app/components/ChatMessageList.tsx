import React, { useEffect, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';

type Props<TItem> = {
  data: TItem[];
  keyExtractor: (item: TItem, index: number) => string;
  renderItem: ({ item, index }: { item: TItem; index: number }) => ReactNode;

  /** Add extra space at the bottom so the fixed composer doesn't cover messages. */
  bottomPadding: number;

  /** Optional header (e.g. translation variants panel). */
  header?: ReactElement | null;

  /** Threshold (px) for "at bottom" detection. */
  atBottomThreshold?: number;

  /** Extra offset from bottom for the floating overlay (px). */
  overlayBottomOffset?: number;
};

/**
 * Shared chat list with:
 * - scroll-to-bottom floating button when scrolled up
 * - "new messages" badge when new items arrive while scrolled up
 */
export default function ChatMessageList<TItem>({
  data,
  keyExtractor,
  renderItem,
  bottomPadding,
  header,
  atBottomThreshold = 40,
  overlayBottomOffset = 24,
}: Props<TItem>) {
  const listRef = useRef<FlatList<TItem> | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unseenCount, setUnseenCount] = useState(0);
  const lastCountRef = useRef(0);
  const firstKeyRef = useRef<string | null>(null);
  const didMountRef = useRef(false);

  function scrollToBottom() {
    setUnseenCount(0);
    setIsAtBottom(true);
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }

  // When a list "identity" changes (e.g., switching rooms), reset counters so we treat
  // it like a fresh chat and jump to the bottom once content is rendered.
  useEffect(() => {
    const nextFirstKey = Array.isArray(data) && data.length > 0 ? keyExtractor(data[0], 0) : null;
    if (!didMountRef.current) {
      didMountRef.current = true;
      firstKeyRef.current = nextFirstKey;
      return;
    }

    if (firstKeyRef.current !== nextFirstKey) {
      firstKeyRef.current = nextFirstKey;
      lastCountRef.current = 0;
      setUnseenCount(0);
      setIsAtBottom(true);
      requestAnimationFrame(scrollToBottom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyExtractor, data]);

  useEffect(() => {
    const prev = lastCountRef.current;
    const next = Array.isArray(data) ? data.length : 0;

    // First load: jump to bottom.
    if (prev === 0 && next > 0) {
      lastCountRef.current = next;
      scrollToBottom();
      return;
    }

    if (next > prev) {
      const delta = next - prev;
      if (isAtBottom) {
        scrollToBottom();
      } else {
        setUnseenCount((c) => c + delta);
      }
    }

    lastCountRef.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isAtBottom]);

  return (
    <View className="flex-1 relative">
      <FlatList
        ref={(r) => {
          listRef.current = r;
        }}
        data={data}
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          const distanceFromBottom =
            contentSize.height - (contentOffset.y + layoutMeasurement.height);
          const atBottom = distanceFromBottom < atBottomThreshold;

          setIsAtBottom(atBottom);
          if (atBottom && unseenCount > 0) setUnseenCount(0);
        }}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingBottom: bottomPadding,
        }}
  ListHeaderComponent={header}
        renderItem={({ item, index }) => <>{renderItem({ item, index })}</>}
      />

      {!isAtBottom ? (
        <View
          className="absolute items-center"
          style={{
            left: 0,
            right: 0,
            bottom: overlayBottomOffset,
          }}
          pointerEvents="box-none"
        >
          <View className="items-center" pointerEvents="auto">
            <TouchableOpacity
              onPress={scrollToBottom}
              activeOpacity={0.85}
              className="h-12 w-12 rounded-full bg-violet-600 items-center justify-center shadow"
            >
              <Text className="text-white text-xl font-bold">↓</Text>
            </TouchableOpacity>

            {unseenCount > 0 ? (
              <TouchableOpacity
                onPress={scrollToBottom}
                activeOpacity={0.9}
                className="mt-2 px-3 py-1 rounded-full bg-gray-900/90"
              >
                <Text className="text-white text-xs font-semibold">{unseenCount} new</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}
