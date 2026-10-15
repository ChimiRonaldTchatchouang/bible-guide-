import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '@/components/icon';
import { PassageText } from '@/components/passage-text';
import { BIBLE_VERSION, getGroup, getTheme } from '@/data/content';
import { useFavorites } from '@/hooks/use-favorites';
import { fonts, radius, spacing, useColors } from '@/theme';

function Block({ icon, title, children }: { icon: IconName; title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.block}>
      <View style={styles.blockHeader}>
        <Icon name={icon} size={16} color={colors.accent} />
        <Text style={[styles.blockTitle, { color: colors.accent }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default function PassageScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const group = getGroup(slug);
  const colors = useColors();
  const { isFavorite, toggle } = useFavorites();
  const [open, setOpen] = useState<Set<number>>(new Set());

  if (!group) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Passage introuvable.</Text>
      </View>
    );
  }

  const fav = isFavorite(group.slug);
  const share = () =>
    Share.share({
      message: `${group.title} — ${group.reference}\n\n${group.verses.map((v) => v.t).join(' ')}\n\n(${BIBLE_VERSION}, via Guide du chrétien)`,
    });
  const toggleParallel = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <>
      <Stack.Screen
        options={{
          title: group.reference,
          headerRight: () => (
            <View style={styles.actions}>
              <Pressable onPress={share} hitSlop={10} accessibilityLabel="Partager">
                <Icon name="share" size={22} color={colors.accent} />
              </Pressable>
              <Pressable
                onPress={() => toggle(group.slug)}
                hitSlop={10}
                accessibilityLabel={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              >
                <Icon name={fav ? 'bookmarkFilled' : 'bookmark'} size={22} color={colors.accent} />
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.tags}>
          {group.themes.map((s) => {
            const t = getTheme(s);
            if (!t) return null;
            return (
              <Pressable
                key={s}
                onPress={() => router.push({ pathname: '/theme/[slug]', params: { slug: s } })}
                style={[styles.tag, { backgroundColor: `${t.color ?? colors.accent}1F` }]}
              >
                <Text style={[styles.tagText, { color: t.color ?? colors.accent }]}>{t.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.title, { color: colors.text }]}>{group.title}</Text>

        {group.contextStory ? (
          <Block icon="story" title="Le contexte">
            <Text style={[styles.prose, { color: colors.text }]}>{group.contextStory}</Text>
          </Block>
        ) : null}

        <View style={[styles.scripture, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.reference, { color: colors.accent }]}>{group.reference}</Text>
          <PassageText verses={group.verses} />
          <Text style={[styles.version, { color: colors.textMuted }]}>{BIBLE_VERSION}</Text>
        </View>

        {group.teaching ? (
          <Block icon="teaching" title="L’enseignement">
            <Text style={[styles.prose, { color: colors.text }]}>{group.teaching}</Text>
          </Block>
        ) : null}

        {group.parallels.length ? (
          <Block icon="parallels" title="Ces passages disent la même chose">
            <View style={styles.parallels}>
              {group.parallels.map((p, i) => {
                const expanded = open.has(i);
                return (
                  <View key={p.reference + i} style={[styles.parallel, { backgroundColor: colors.surfaceMuted }]}>
                    <Pressable
                      onPress={() => toggleParallel(i)}
                      style={styles.parallelHeader}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.parallelRef, { color: colors.text }]}>{p.reference}</Text>
                      <Text style={[styles.parallelToggle, { color: colors.accent }]}>
                        {expanded ? 'Masquer' : 'Lire'}
                      </Text>
                    </Pressable>
                    {expanded ? <PassageText verses={p.verses} size={16} /> : null}
                  </View>
                );
              })}
            </View>
          </Block>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2, gap: spacing.xl },
  actions: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: 999 },
  tagText: { fontSize: 12, fontWeight: '700' },
  title: { fontFamily: fonts.serifBold, fontSize: 28, lineHeight: 36, marginTop: -spacing.sm },
  block: { gap: spacing.sm },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  blockTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  prose: { fontSize: 16, lineHeight: 25 },
  scripture: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing.xl, gap: spacing.md },
  reference: { fontFamily: fonts.serifSemiBold, fontSize: 15 },
  version: { fontSize: 11, fontStyle: 'italic', textAlign: 'right' },
  parallels: { gap: spacing.sm },
  parallel: { borderRadius: radius.sm, padding: spacing.md, gap: spacing.sm },
  parallelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  parallelRef: { fontFamily: fonts.serifSemiBold, fontSize: 15 },
  parallelToggle: { fontSize: 13, fontWeight: '700' },
});
