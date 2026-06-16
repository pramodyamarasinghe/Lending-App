import 'react-native-url-polyfill/auto';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack, useRouter, useRootNavigationState } from 'expo-router';
import { useColorScheme } from 'react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { account, autoLoginWithSavedCredentials } from '@/lib/appwrite';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (!isLoading && navigationState?.key) {
      if (isLoggedIn) {
        router.replace('/');
      } else {
        router.replace('/login');
      }
    }
  }, [isLoading, isLoggedIn, navigationState?.key]);

  async function checkSession() {
    try {
      await account.get();
      setIsLoggedIn(true);
    } catch {
      const sessionExists = await autoLoginWithSavedCredentials();
      setIsLoggedIn(sessionExists);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <View style={{ flex: 1, backgroundColor: '#208AEF' }} />
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen 
            name="index" 
            options={{ gestureEnabled: false }}
            listeners={{
              beforeRemove: () => {},
            }}
          />
          <Stack.Screen name="login" options={{ gestureEnabled: false }} />
          <Stack.Screen name="signup" />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
