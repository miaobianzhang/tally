import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SessionModal } from '../components/SessionModal';
import { CategoryProvider } from '../hooks/useCategories';
import { PlanProvider } from '../hooks/usePlans';
import { ProfileProvider } from '../hooks/useProfile';
import { SyncProvider } from '../hooks/useSync';
import { TallyProvider } from '../hooks/useTally';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';

void SplashScreen.preventAutoHideAsync().catch(() => {});

function ThemedRoot() {
  const { colors, hydrated } = useTheme();

  useEffect(() => {
    if (hydrated) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [hydrated]);

  if (!hydrated) {
    return <View style={{ flex: 1, backgroundColor: colors.page }} />;
  }

  return (
    <>
      <StatusBar
        style={colors.textOnPage === '#F5F5F2' ? 'light' : 'dark'}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.page },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="weekly"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="monthly"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="custom"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="settings"
          options={{ animation: 'slide_from_right' }}
        />
      </Stack>
      <SessionModal />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ThemeProvider>
      <ProfileProvider>
        <CategoryProvider>
          <TallyProvider>
            <PlanProvider>
              <SyncProvider>
                <ThemedRoot />
              </SyncProvider>
            </PlanProvider>
          </TallyProvider>
        </CategoryProvider>
      </ProfileProvider>
    </ThemeProvider>
    </GestureHandlerRootView>
  );
}
