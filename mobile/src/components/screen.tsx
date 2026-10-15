import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, spacing, useColors } from '@/theme';

/** Écran d'onglet défilant avec grand titre (les onglets natifs n'ont pas d'en-tête). */
export function TabScreen({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
    >
      <View style={styles.header}>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.accent }]}>
            {subtitle.charAt(0).toUpperCase() + subtitle.slice(1)}
          </Text>
        ) : null}
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      </View>
      {children}
    </ScrollView>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const colors = useColors();
  return <Text style={[styles.section, { color: colors.textMuted }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl * 2, gap: spacing.lg },
  header: { gap: 2, marginBottom: spacing.xs },
  subtitle: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  title: { fontFamily: fonts.serifBold, fontSize: 32, lineHeight: 40 },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: spacing.sm },
});
