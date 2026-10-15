import { useColorScheme } from 'react-native';

const light = {
  background: '#FBF7EF',
  surface: '#FFFFFF',
  surfaceMuted: '#F3ECDF',
  text: '#2A2420',
  textMuted: '#6E6358',
  border: '#E6DCCB',
  primary: '#1E2B47',
  onPrimary: '#FBF7EF',
  accent: '#B8862F',
  accentSoft: '#F4E7CC',
  verseNumber: '#B8862F',
};

const dark: typeof light = {
  background: '#131C30',
  surface: '#1C2740',
  surfaceMuted: '#22304D',
  text: '#F1EADD',
  textMuted: '#A9A193',
  border: '#2E3C5C',
  primary: '#D6A84F',
  onPrimary: '#131C30',
  accent: '#E2BC6E',
  accentSoft: '#3A3424',
  verseNumber: '#E2BC6E',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 14, lg: 20 } as const;

export const fonts = {
  serif: 'Lora_400Regular',
  serifItalic: 'Lora_400Regular_Italic',
  serifSemiBold: 'Lora_600SemiBold',
  serifBold: 'Lora_700Bold',
} as const;
