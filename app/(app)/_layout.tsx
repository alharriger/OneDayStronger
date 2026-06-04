import { Tabs } from 'expo-router';
import { CalendarCheck, ClipboardText, ChartLine, User } from 'phosphor-react-native';
import { Colors, Typography } from '@/theme';
import { useOnboardingGuard } from '@/hooks/useOnboardingGuard';
import { useOfflineSync } from '@/hooks/useOfflineSync';

export default function AppLayout() {
  // Redirect to correct onboarding screen if setup is incomplete
  useOnboardingGuard();
  // Flush pending workout logs whenever the device comes back online
  useOfflineSync();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.text.disabled,
        tabBarStyle: {
          backgroundColor: Colors.bg.base,
          borderTopColor: Colors.border.strong,
          borderTopWidth: 1,
          height: 76,
        },
        tabBarItemStyle: {
          paddingTop: 14,
          paddingBottom: 18,
        },
        tabBarLabelStyle: {
          ...Typography.label,
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => <CalendarCheck size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color, size }) => <ClipboardText size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => <ChartLine size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="log-workout"
        options={{
          href: null, // hidden from tab bar; reached via router.push
        }}
      />
      <Tabs.Screen
        name="post-workout-checkin"
        options={{
          href: null, // hidden from tab bar; reached via router.push from log-workout
        }}
      />
    </Tabs>
  );
}
