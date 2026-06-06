import { Tabs } from 'expo-router';
import { useOnboardingGuard } from '@/hooks/useOnboardingGuard';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { AppTabBar } from '@/components/ui/AppTabBar';

export default function AppLayout() {
  // Redirect to correct onboarding screen if setup is incomplete
  useOnboardingGuard();
  // Flush pending workout logs whenever the device comes back online
  useOfflineSync();

  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today' }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen
        name="log-workout"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="post-workout-checkin"
        options={{ href: null }}
      />
    </Tabs>
  );
}
