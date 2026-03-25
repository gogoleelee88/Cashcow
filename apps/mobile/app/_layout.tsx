import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: (failureCount, error: any) => {
        if (error?.response?.status === 401 || error?.response?.status === 404) return false;
        return failureCount < 2;
      },
    },
  },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    // Add custom fonts here if bundled
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" backgroundColor="#0d0b18" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#12101f' },
            headerTintColor: '#f0ecff',
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: '#0d0b18' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="chat/[id]" options={{ headerShown: true, title: '' }} />
          <Stack.Screen name="characters/[id]" options={{ headerShown: true, title: '' }} />
          <Stack.Screen name="auth/login" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="auth/register" options={{ headerShown: false, presentation: 'modal' }} />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
