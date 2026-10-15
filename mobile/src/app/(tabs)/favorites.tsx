import { StyleSheet, Text, View } from 'react-native';
import { GroupCard } from '@/components/group-card';
import { Icon } from '@/components/icon';
import { TabScreen } from '@/components/screen';
import { getGroup } from '@/data/content';
import { useFavorites } from '@/hooks/use-favorites';
import { fonts, spacing, useColors } from '@/theme';

export default function FavoritesScreen() {
  const colors = useColors();
  const { favorites } = useFavorites();
  const items = favorites.map(getGroup).filter((g) => g !== undefined);

  return (
    <TabScreen title="Mes favoris">
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="bookmark" size={40} color={colors.accent} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucun passage enregistré</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Touchez le signet en haut d’un passage pour le retrouver ici, même sans connexion.
          </Text>
        </View>
      ) : (
        items.map((g) => <GroupCard key={g.slug} group={g} />)
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl * 2, paddingHorizontal: spacing.xl },
  emptyTitle: { fontFamily: fonts.serifSemiBold, fontSize: 19 },
  emptyText: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
