import React from 'react';
import { Text, TextProps } from 'react-native';

/**
 * ErrorText
 *
 * On React Native Web, RNW injects a generated class on <Text> that can set `color: black`
 * (e.g. `.css-text-xxxx { color: rgb(0,0,0) }`) which may override Tailwind classes.
 *
 * Using an explicit `style.color` ensures readable error text on web while keeping
 * NativeWind `className` styling for native.
 */
export default function ErrorText({
  children,
  className,
  style,
  ...props
}: TextProps & { className?: string }) {
  return (
    <Text
      {...props}
      className={['text-red-100', className].filter(Boolean).join(' ')}
      style={[{ color: '#FFE4E6' }, style]}
    >
      {children}
    </Text>
  );
}
