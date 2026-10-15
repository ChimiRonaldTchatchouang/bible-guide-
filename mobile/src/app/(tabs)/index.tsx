import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GroupCard } from '@/components/group-card';
import { Icon, iconFor } from '@/components/icon';
import { SectionTitle, TabScreen } from '@/components/screen';
import { dailyGroup, excerpt, getTheme, groups, rootThemes } from '@/data/content';
import { fonts, radius, spacing, useColors } from '@/theme';

export default function TodayScreen() {
  const colors = useColors();
  const today = dailyGroup();
  const theme = getTheme(today.themes[0] ?? '');
  const dateLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const others = groups.filter((g) => g.slug !== today.slug).slice(0, 4);

  return (
    <TabScreen title="Lecture du jour" subtitle={dateLabel}>
      <Pressable
        onPress={() => router.push({ pathname: '/passage/[slug]', params: { slug: today.slug } })}
        style={({ pressed }) => [styles.hero, { backgroundColor: colors.primary, opacity: pressed ? 0.92 : 1 }]}
      >
        {theme ? <Text style={[styles.heroTheme, { color: colors.onPrimary }]}>{theme.name.toUpperCase()}</Text> : null}
        <Text style={[styles.heroTitle, { color: colors.onPrimary }]}>{today.title}</Text>
        <Text style={[styles.heroRef, { color: colors.onPrimary }]}>{today.reference}</Text>
        <Text style={[styles.heroExcerpt, { color: colors.onPrimary }]} numberOfLines={3}>
          « {excerpt(today, 180)} »
        </Text>
        <View style={[styles.heroButton, { backgroundColor: colors.onPrimary }]}>
          <Icon name="book" size={16} color={colors.primary} />
          <Text style={[styles.heroButtonText, { color: colors.primary }]}>Lire le passage</Text>
        </View>
      </Pressable>

      <SectionTitle>Thèmes de vie</SectionTitle>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipsScroll}
      >
        {rootThemes().map((t) => (
          <Pressable
            key={t.slug}
            onPress={() => router.push({ pathname: '/theme/[slug]', params: { slug: t.slug } })}
            style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Icon name={iconFor(t.icon)} size={16} color={t.color ?? colors.accent} />
            <Text style={[styles.chipText, { color: colors.text }]}>{t.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <SectionTitle>À méditer aussi</SectionTitle>
      {others.map((g) => (
        <GroupCard key={g.slug} group={g} />
      ))}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm },
  heroTheme: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, opacity: 0.75 },
  heroTitle: { fontFamily: fonts.serifBold, fontSize: 26, lineHeight: 33 },
  heroRef: { fontSize: 14, opacity: 0.8 },
  heroExcerpt: { fontFamily: fonts.serifItalic, fontSize: 16, lineHeight: 25, opacity: 0.92, marginTop: spacing.xs },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: 999,
    marginTop: spacing.sm,
  },
  heroButtonText: { fontWeight: '700', fontSize: 14 },
  chipsScroll: { marginHorizontal: -spacing.lg },
  chips: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
});
