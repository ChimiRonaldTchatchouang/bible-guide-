import { StyleSheet, Text } from 'react-native';
import type { Verse } from '@/data/content';
import { fonts, useColors } from '@/theme';

/** Texte biblique en un seul paragraphe, numéros de versets en exposant doré. */
export function PassageText({ verses, size = 18 }: { verses: Verse[]; size?: number }) {
  const colors = useColors();
  return (
    <Text selectable style={[styles.text, { color: colors.text, fontSize: size, lineHeight: size * 1.65 }]}>
      {verses.map((v, i) => (
        <Text key={`${v.c}:${v.v}`}>
          {i > 0 ? ' ' : ''}
          <Text style={[styles.number, { color: colors.verseNumber, fontSize: size * 0.62 }]}>{v.v} </Text>
          {v.t}
        </Text>
      ))}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontFamily: fonts.serif },
  number: { fontFamily: fonts.serifSemiBold },
});
