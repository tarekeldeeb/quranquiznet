// Read-only strip showing the current quiz settings: a centered summary line
// (level + special-questions state) followed directly by the in-scope sura chips.
// The chips show in full when they fit on one line; if they wrap to multiple
// lines they collapse to a single row with a "المزيد" toggle. This applies on
// every platform (web included) and re-measures on width changes (window resize).
// Informative only — no editing here.
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, LayoutChangeEvent,
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

export default function QuizSettingsBar({
  levelText, specialEnabled, scopeNames, scopeMode,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const widthRef = useRef(0);

  const summary = `${levelText} - الأسئلة الخاصة ${specialEnabled ? 'مُفعّلة' : 'غير مُفعّلة'}`;
  const scopeKey = scopeNames.join('|');

  // Reset measurement whenever the scope changes (new session / mode).
  useEffect(() => {
    setOverflow(false);
    setExpanded(false);
  }, [scopeKey]);

  const clamp = overflow && !expanded;

  // Measure the chips container: taller than one row ⇒ the chips wrapped.
  // A width change (e.g. window resize) re-measures from scratch.
  function onContainerLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    if (widthRef.current && Math.abs(width - widthRef.current) > 1) {
      widthRef.current = width;
      setOverflow(false);      // next (unclamped) pass re-measures
      return;
    }
    widthRef.current = width;
    if (!clamp && height > ROW_HEIGHT + 6 && !overflow) setOverflow(true);
  }

  return (
    <View style={s.wrapper}>
      <Text style={s.summary}>{summary}</Text>

      {scopeMode === 'daily' ? (
        <Text style={s.note}>أسئلة مختارة تلقائياً من نطاق حفظك</Text>
      ) : (
        <>
          <View
            style={[s.chips, clamp && { maxHeight: ROW_HEIGHT, overflow: 'hidden' }]}
            onLayout={onContainerLayout}
          >
            {scopeNames.map((name, i) => (
              <Text key={i} style={s.chip}>{name}</Text>
            ))}
          </View>
          {overflow && (
            <TouchableOpacity
              style={s.toggle}
              onPress={() => setExpanded((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={s.toggleTxt}>{expanded ? 'أقل ▴' : 'المزيد ▾'}</Text>
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
