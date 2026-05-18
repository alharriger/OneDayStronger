import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  Lato_400Regular,
  Lato_700Bold,
  Lato_900Black,
} from '@expo-google-fonts/lato';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import { useFonts } from 'expo-font';
import { useAuth } from '@/hooks/useAuth';

// NOTE: Do NOT call SplashScreen.preventAutoHideAsync() here.
// expo-router manages the splash screen via its own internal track.
// Calling the public preventAutoHideAsync() creates a second lock that
// must be released separately, and caused the splash to never dismiss.

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Lato_400Regular,
    Lato_700Bold,
    Lato_900Black,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  const isReady = fontsLoaded && !authLoading;

  useEffect(() => {
    if (!isReady) return;
    SplashScreen.hideAsync();
  }, [isReady]);

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user) {
      if (inAuthGroup) {
        router.replace('/(app)/today');
      }
    }
  }, [user, isReady, segments]);

  return (
    <>
      <StatusBar style="auto" />
      <Slot />
      {!isReady && (
        <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#1F1A16', justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color="#EFEAE2" size="large" />
        </View>
      )}
    </>
  );
}
