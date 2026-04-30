import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/store';

export default function RootLayout() {
  const { hydrated, hydrate, token } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    const onAuthScreen = segments[0] === 'login' || segments[0] === 'register';
    if (!token && !onAuthScreen) router.replace('/login');
    else if (token && onAuthScreen) router.replace('/');
  }, [hydrated, token, segments, router]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFF1F5' } }} />
    </SafeAreaProvider>
  );
}
