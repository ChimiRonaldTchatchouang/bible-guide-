import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { tabIcon } from '@/components/icon';
import { useColors } from '@/theme';

export default function TabsLayout() {
  const colors = useColors();
  return (
    <NativeTabs tintColor={colors.accent} backgroundColor={colors.surface} indicatorColor={colors.accentSoft}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon {...tabIcon('today')} />
        <NativeTabs.Trigger.Label>{"Aujourd'hui"}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="themes">
        <NativeTabs.Trigger.Icon {...tabIcon('themes')} />
        <NativeTabs.Trigger.Label>Thèmes</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="favorites">
        <NativeTabs.Trigger.Icon {...tabIcon('favorites')} />
        <NativeTabs.Trigger.Label>Favoris</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
