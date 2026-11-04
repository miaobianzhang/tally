import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { SessionModal } from '../components/SessionModal';
import { PlanProvider } from '../hooks/usePlans';
import { TallyProvider } from '../hooks/useTally';
import { colors } from '../theme';

export default function RootLayout() {
  return (
    <TallyProvider>
      <PlanProvider>
        <StatusBar style="dark" />
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
        </Stack>
        <SessionModal />
      </PlanProvider>
    </TallyProvider>
  );
}
