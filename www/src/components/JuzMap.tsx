// The me-screen mini map: the 30 ajzāʾ as a 5×6 grid inside the خريطة الحفظ
// card — one glance answers "how much of the muṣḥaf is under study, and how
// is each region doing". Plain Views only (same no-SVG rule as KhatamStar).
//
// The parent card's navy ground never flips with the theme, so cell colors
// are fixed navy-family constants rather than theme tokens: bright gold =
// متقن, translucent gold = جيد, terracotta = يحتاج مراجعة, soft blue = under
// study but untested, dashed outline = outside the study plan. Each cell
// fills bottom-up with the fraction of the juz covered by checked parts, so
// hue and fill height carry the signal together (not color alone).
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { JuzCell } from '../models/juzMap';
import type { MasteryTier } from '../models/milestones';
import { localeNum } from '../theme/tokens';
import { rowDir } from '../theme/direction';
import type { Language } from '../i18n/languages';

const FILL: Record<MasteryTier, string> = {
  HIGH: '#d9ad55',
  MID: 'rgba(217,173,85,0.42)',
  LOW: '#d2766c',
  EMPTY: 'rgba(143,176,207,0.32)',
};
// Dark numeral once a solid fill reaches behind the number; light otherwise.
const NUM_DARK = '#081e35';
const NUM_LIGHT = '#dce7f2';
const NUM_OFF = 'rgba(143,176,207,0.75)';
const OUTLINE = 'rgba(143,176,207,0.4)';

const COLS = 5;

interface Props {
  cells: JuzCell[];
  language: Language;
  isRTL: boolean;
}

export default function JuzMap({ cells, language, isRTL }: Props) {
  const rows: JuzCell[][] = [];
  for (let r = 0; r < cells.length; r += COLS) rows.push(cells.slice(r, r + COLS));
  return (
    // Purely a visual summary of the parts list — hidden from screen readers;
    // the parent card's title/subtitle already announce the same information.
    <View style={s.grid} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {rows.map((row, r) => (
        <View key={r} style={[s.row, { flexDirection: rowDir(isRTL) }]}>
          {row.map((cell, c) => {
            const j = r * COLS + c;
            const solidFill = cell.coverage > 0.55 && (cell.tier === 'HIGH' || cell.tier === 'LOW');
            return (
              <View key={c} style={[s.cell, cell.tier === null && s.cellOff]}>
                {cell.tier !== null && (
                  <View
                    style={[s.fill, {
                      height: `${Math.round(cell.coverage * 100)}%`,
                      backgroundColor: FILL[cell.tier],
                    }]}
                  />
                )}
                <Text style={[s.num, { color: cell.tier === null ? NUM_OFF : solidFill ? NUM_DARK : NUM_LIGHT }]}>
                  {localeNum(j + 1, language)}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { alignSelf: 'stretch', gap: 5 },
  row: { gap: 5 },
  cell: {
    flex: 1,
    height: 32,
    borderRadius: 7,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cellOff: {
    backgroundColor: 'transparent',
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: OUTLINE,
  },
  fill: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  num: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
