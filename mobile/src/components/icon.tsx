import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import type { ColorValue } from 'react-native';

/** Paires d'icônes natives : SF Symbols (iOS) / Material Symbols (Android). */
const ICONS = {
  today: { ios: 'sun.max.fill', android: 'wb_sunny' },
  themes: { ios: 'square.grid.2x2.fill', android: 'grid_view' },
  favorites: { ios: 'bookmark.fill', android: 'bookmarks' },
  bookmark: { ios: 'bookmark', android: 'bookmark_border' },
  bookmarkFilled: { ios: 'bookmark.fill', android: 'bookmark' },
  share: { ios: 'square.and.arrow.up', android: 'share' },
  chevron: { ios: 'chevron.right', android: 'chevron_right' },
  story: { ios: 'scroll', android: 'history_edu' },
  teaching: { ios: 'lightbulb.fill', android: 'lightbulb' },
  parallels: { ios: 'link', android: 'link' },
  book: { ios: 'book.fill', android: 'menu_book' },
  // Icônes des thèmes (champ `icon` du contenu)
  sparkles: { ios: 'sparkles', android: 'auto_awesome' },
  heart: { ios: 'hands.sparkles.fill', android: 'volunteer_activism' },
  rings: { ios: 'figure.2', android: 'family_restroom' },
  infinity: { ios: 'infinity', android: 'all_inclusive' },
  'search-heart': { ios: 'heart.text.square.fill', android: 'favorite' },
  briefcase: { ios: 'briefcase.fill', android: 'work' },
  shield: { ios: 'shield.fill', android: 'shield' },
  lamp: { ios: 'lightbulb.fill', android: 'lightbulb' },
} satisfies Record<string, { ios: SFSymbol; android: AndroidSymbol }>;

export type IconName = keyof typeof ICONS;

export const iconFor = (name: string | null | undefined): IconName =>
  name && name in ICONS ? (name as IconName) : 'book';

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color: ColorValue }) {
  const icon = ICONS[name];
  // Android et web utilisent tous deux la police Material Symbols.
  return (
    <SymbolView
      name={{ ios: icon.ios, android: icon.android, web: icon.android }}
      size={size}
      tintColor={color}
      resizeMode="scaleAspectFit"
    />
  );
}

export const tabIcon = (name: 'today' | 'themes' | 'favorites') => ({
  sf: ICONS[name].ios,
  md: ICONS[name].android,
});
