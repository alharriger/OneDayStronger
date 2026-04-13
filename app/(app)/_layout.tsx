import { Tabs } from 'expo-router';
import { CalendarCheck, ClipboardText, ChartLine, User } from 'phosphor-react-native';
import { Colors, Typography } from '@/theme';
import { useOnboardingGuard } from '@/hooks/useOnboardingGuard';

export default function AppLayout() {
  // Redirect to correct onboarding screen if setup is incomplete
  useOnboardingGuard();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.text.disabled,
        tabBarStyle: {
          backgroundColor: Colors.bg.surfaceRaised,
          borderTopColor: Colors.border.default,
          borderTopWidth: 1,
          height: 56,
        },
        tabBarLabelStyle: {
          ...Typography.label,
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
    </Tabs>
  );
}
