import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, iconFor } from '@/components/icon';
import { TabScreen } from '@/components/screen';
import { childThemes, groupsForTheme, rootThemes } from '@/data/content';
import { fonts, radius, spacing, useColors } from '@/theme';

export default function ThemesScreen() {
  const colors = useColors();
  return (
    <TabScreen title="Thèmes de vie" subtitle="Ce que dit la Bible sur…">
      {rootThemes().map((t) => {
        const count = groupsForTheme(t.slug).length;
        const children = childThemes(t.slug);
        const tint = t.color ?? colors.accent;
        return (
          <Pressable
            key={t.slug}
            onPress={() => router.push({ pathname: '/theme/[slug]', params: { slug: t.slug } })}

            style={({ pressed }) => [
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={[styles.badge, { backgroundColor: `${tint}22` }]}>
              <Icon name={iconFor(t.icon)} size={24} color={tint} />
            </View>
            <View style={styles.body}>
              <Text style={[styles.name, { color: colors.text }]}>{t.name}</Text>
              {t.description ? (
                <Text style={[styles.desc, { color: colors.textMuted }]} numberOfLines={2}>
                  {t.description}
                </Text>
              ) : null}
              <Text style={[styles.meta, { color: tint }]}>
                {count} passage{count > 1 ? 's' : ''}
                {children.length ? ` · ${children.map((c) => c.name).join(', ')}` : ''}
              </Text>
            </View>
            <Icon name="chevron" size={16} color={colors.textMuted} />
          </Pressable>
        );
      })}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badge: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 3 },
  name: { fontFamily: fonts.serifSemiBold, fontSize: 18 },
  desc: { fontSize: 13, lineHeight: 19 },
  meta: { fontSize: 12, fontWeight: '600', marginTop: 2 },
});
