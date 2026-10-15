import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { excerpt, getTheme, type PassageGroup } from '@/data/content';
import { fonts, radius, spacing, useColors } from '@/theme';
import { Icon } from './icon';

export function GroupCard({ group }: { group: PassageGroup }) {
  const colors = useColors();
  const theme = getTheme(group.themes[0] ?? '');
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/passage/[slug]', params: { slug: group.slug } })}

      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.row}>
        {theme ? (
          <Text style={[styles.theme, { color: theme.color ?? colors.accent }]} numberOfLines={1}>
            {theme.name.toUpperCase()}
          </Text>
        ) : null}
        <Text style={[styles.reference, { color: colors.textMuted }]}>{group.reference}</Text>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{group.title}</Text>
      <Text style={[styles.excerpt, { color: colors.textMuted }]} numberOfLines={2}>
        {excerpt(group)}
      </Text>
      <View style={styles.footer}>
        <Icon name="parallels" size={14} color={colors.textMuted} />
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {group.parallels.length} passage{group.parallels.length > 1 ? 's' : ''} parallèle
          {group.parallels.length > 1 ? 's' : ''}
        </Text>
        <View style={{ flex: 1 }} />
        <Icon name="chevron" size={14} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg, gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  theme: { fontSize: 11, fontWeight: '700', letterSpacing: 1, flexShrink: 1 },
  reference: { fontSize: 12 },
  title: { fontFamily: fonts.serifSemiBold, fontSize: 19, lineHeight: 25 },
  excerpt: { fontFamily: fonts.serif, fontSize: 14, lineHeight: 21 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  meta: { fontSize: 12 },
});
