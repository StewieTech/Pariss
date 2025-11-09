// app/components/GlassWrapper.tsx
import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

export default function GlassWrapper({ children, className }: React.PropsWithChildren<{className?: string}>) {
  return (
    <LinearGradient
      colors={['#0B0B10', '#1B0F2E', '#2B0B4A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="flex-1"
    >
      <View className={`flex-1 p-4 ${className || ''}`}>
        <BlurView intensity={30} tint="dark" className="rounded-3xl overflow-hidden flex-1">
          {children}
        </BlurView>
      </View>
    </LinearGradient>
  );
}
