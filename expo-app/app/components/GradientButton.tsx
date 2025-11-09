// app/components/GradientButton.tsx
import { Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export function GradientButton({
  title, onPress, className = ''
}: { title: string; onPress: () => void; className?: string }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} className={`rounded-2xl overflow-hidden ${className}`}>
      <LinearGradient
        colors={['#6D28D9', '#7C3AED']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="px-6 py-4"
      >
        <Text className="text-white font-semibold text-center">{title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}
