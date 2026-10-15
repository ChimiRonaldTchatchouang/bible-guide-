import {
  Lora_400Regular,
  Lora_400Regular_Italic,
  Lora_600SemiBold,
  Lora_700Bold,
  useFonts,
} from '@expo-google-fonts/lora';
import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { FavoritesProvider } from '@/hooks/use-favorites';
import { fonts, useColors } from '@/theme';

// Garde l'écran de démarrage affiché jusqu'au chargement des polices.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 500, fade: true });

export default function RootLayout() {
  const scheme = useColorScheme();
  const colors = useColors();
  const [loaded, error] = useFonts({ Lora_400Regular, Lora_400Regular_Italic, Lora_600SemiBold, Lora_700Bold });

  useEffect(() => {
    if (loaded || error) SplashScreen.hide();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <FavoritesProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fonts.serifSemiBold, color: colors.text },
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="passage/[slug]" options={{ title: '' }} />
          <Stack.Screen name="theme/[slug]" options={{ title: '' }} />
        </Stack>
      </FavoritesProvider>
    </ThemeProvider>
  );
}
