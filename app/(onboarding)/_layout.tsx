import { Stack } from 'expo-router';
import { Colors } from '@/theme';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bg.base },
        animation: 'slide_from_right',
      }}
    />
  );
}
