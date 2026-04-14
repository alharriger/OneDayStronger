import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

// Keep splash visible until fonts + auth are ready
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  const isReady = fontsLoaded && !authLoading;

  useEffect(() => {
    if (!isReady) return;
    SplashScreen.hideAsync();
  }, [isReady]);

  // Hard timeout — always hide splash after 5s to surface errors
  useEffect(() => {
    const t = setTimeout(() => SplashScreen.hideAsync(), 5000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Not signed in — route to login
      router.replace('/(auth)/login');
    } else if (user) {
      // Signed in — let the onboarding guard handle where to send them
      if (inAuthGroup) {
        router.replace('/(app)/today');
      }
    }
  }, [user, isReady, segments]);

  if (!isReady) return null;

  return (
    <>
      <StatusBar style="auto" />
      <Slot />
    </>
  );
}
