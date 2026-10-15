import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GroupCard } from '@/components/group-card';
import { Icon, iconFor } from '@/components/icon';
import { childThemes, getTheme, groupsForTheme } from '@/data/content';
import { fonts, radius, spacing, useColors } from '@/theme';

export default function ThemeScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const colors = useColors();
  const theme = getTheme(slug);

  if (!theme) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Thème introuvable.</Text>
      </View>
    );
  }

  const tint = theme.color ?? colors.accent;
  const children = childThemes(theme.slug);
  const list = groupsForTheme(theme.slug);

  return (
    <>
      <Stack.Screen options={{ title: theme.name }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={[styles.hero, { backgroundColor: `${tint}18` }]}>
          <View style={[styles.badge, { backgroundColor: tint }]}>
            <Icon name={iconFor(theme.icon)} size={28} color="#FFFFFF" />
          </View>
          <Text style={[styles.name, { color: colors.text }]}>{theme.name}</Text>
          {theme.description ? (
            <Text style={[styles.desc, { color: colors.textMuted }]}>{theme.description}</Text>
          ) : null}
        </View>

        {children.length ? (
          <View style={styles.children}>
            {children.map((c) => (
              <Pressable
                key={c.slug}
                onPress={() => router.push({ pathname: '/theme/[slug]', params: { slug: c.slug } })}
                style={[styles.child, { borderColor: tint }]}
              >
                <Text style={[styles.childText, { color: tint }]}>{c.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {list.map((g) => (
          <GroupCard key={g.slug} group={g} />
        ))}
        {list.length === 0 ? (
          <Text style={[styles.desc, { color: colors.textMuted, textAlign: 'center' }]}>
            Les passages de ce thème arrivent bientôt.
          </Text>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2, gap: spacing.lg },
  hero: { borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  badge: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  name: { fontFamily: fonts.serifBold, fontSize: 26, textAlign: 'center' },
  desc: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  children: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  child: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: spacing.md + 2, paddingVertical: spacing.sm },
  childText: { fontSize: 14, fontWeight: '700' },
});
