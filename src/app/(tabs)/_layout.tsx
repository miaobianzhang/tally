import { Tabs } from 'expo-router/js-tabs';

import { BottomTabs } from '../../components/BottomTabs';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomTabs {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: '计时' }} />
      <Tabs.Screen name="plan" options={{ title: '计划' }} />
      <Tabs.Screen name="analysis" options={{ title: '分析' }} />
    </Tabs>
  );
}
