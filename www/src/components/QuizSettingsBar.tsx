// Read-only strip showing the current quiz settings: a centered summary line
// (level + special-questions state) followed by the in-scope sura chips.
// The sura list is collapsible: it defaults to a single clipped row with a
// "المزيد ▾" toggle and expands to show every chip on tap. Deterministic — no
// layout measurement — so it collapses reliably on every platform.
// Informative only — no editing here.
import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';

export type ScopeMode = 'random' | 'custom' | 'daily';

interface Props {
  levelText: string;       // e.g. "مستوى أولي"
  specialEnabled: boolean;
  scopeNames: string[];    // in-scope part names (suras / juz)
  scopeMode: ScopeMode;
}

const CHIP_LINE = 16;       // chip text lineHeight
const CHIP_PAD_V = 4;       // chip vertical padding
const ROW_HEIGHT = CHIP_LINE + CHIP_PAD_V * 2;   // height of a single chip row

// Below this many chips they comfortably fit on one row, so no toggle is shown.
const COLLAPSE_THRESHOLD = 3;

export default function QuizSettingsBar({
  levelText, specialEnabled, scopeNames, scopeMode,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const summary = scopeMode === 'daily'
    ? 'اختبار اليوم النشط'
    : `${levelText} - الأسئلة الخاصة ${specialEnabled ? 'مُفعّلة' : 'غير مُفعّلة'}`;
  const scopeKey = scopeNames.join('|');

  // Collapse again whenever the scope changes (new session / mode).
  useEffect(() => { setExpanded(false); }, [scopeKey]);

  const collapsible = scopeMode !== 'daily' && scopeNames.length > COLLAPSE_THRESHOLD;
  const clamp = collapsible && !expanded;

  return (
    <View style={s.wrapper}>
      <Text style={s.summary}>{summary}</Text>

      {scopeMode === 'daily' ? (
        <Text style={s.note}>أسئلة مختارة تلقائياً من نطاق حفظك</Text>
      ) : (
        <>
          <View style={[s.chips, clamp && { maxHeight: ROW_HEIGHT, overflow: 'hidden' }]}>
            {scopeNames.map((name, i) => (
              <Text key={i} style={s.chip}>{name}</Text>
            ))}
          </View>
          {collapsible && (
            <TouchableOpacity
              style={s.toggle}
              onPress={() => setExpanded((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={s.toggleTxt}>
                {expanded ? 'أقل ▴' : `المزيد (${scopeNames.length}) ▾`}
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#dde6ee',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  summary: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0d2d4e',
    textAlign: 'center',
    marginBottom: 8,
  },
  note: { fontSize: 13, color: '#5b7186', textAlign: 'center' },
  chips: {
    flexDirection: 'row-reverse',   // RTL: first sura on the right (app convention)
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 6,
  },
  chip: {
    fontSize: 12,
    lineHeight: CHIP_LINE,
    color: '#0d2d4e',
    backgroundColor: '#eef3f8',
    paddingHorizontal: 9,
    paddingVertical: CHIP_PAD_V,
    borderRadius: 12,
    overflow: 'hidden',
  },
  toggle: { marginTop: 6, paddingVertical: 2, paddingHorizontal: 10 },
  toggleTxt: { fontSize: 12, fontWeight: '700', color: '#a9690a' },
});
