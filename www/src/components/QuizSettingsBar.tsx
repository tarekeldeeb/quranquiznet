// Read-only strip showing the current quiz settings: a centered summary line
// (level + special-questions state) followed by the in-scope sura chips.
// The sura list is collapsible: it defaults to a single clipped row with a
// "المزيد ▾" toggle and expands to show every chip on tap. Deterministic — no
// layout measurement — so it collapses reliably on every platform.
// Informative only — no editing here.
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import PressScale from './PressScale';
import { useTheme, radii } from '../theme/tokens';
import { useDirection, rowDir } from '../theme/direction';

export type ScopeMode = 'random' | 'custom' | 'daily';

interface Props {
  levelText: string;       // e.g. "مستوى أولي"
  specialEnabled: boolean;
  scopeNames: string[];    // in-scope part names (suras / juz)
  scopeMode: ScopeMode;
  // Daily-mode progress: which question (1-based) out of how many total. Used to
  // render the progress bar so the user sees how many questions remain.
  dailyCurrent?: number;
  dailyTotal?: number;
}

const CHIP_LINE = 16;       // chip text lineHeight
const CHIP_PAD_V = 4;       // chip vertical padding
const ROW_HEIGHT = CHIP_LINE + CHIP_PAD_V * 2;   // height of a single chip row

// Below this many chips they comfortably fit on one row, so no toggle is shown.
const COLLAPSE_THRESHOLD = 3;

export default function QuizSettingsBar({
  levelText, specialEnabled, scopeNames, scopeMode, dailyCurrent = 0, dailyTotal = 0,
}: Props) {
  const { t } = useTranslation();
  const { isRTL } = useDirection();
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const summary = scopeMode === 'daily'
    ? t('common.quizSettingsBar.dailyActive')
    : t('common.quizSettingsBar.summary', {
      level: levelText,
      specialState: t(specialEnabled ? 'common.quizSettingsBar.specialOn' : 'common.quizSettingsBar.specialOff'),
    });
  const scopeKey = scopeNames.join('|');

  // Collapse again whenever the scope changes (new session / mode).
  useEffect(() => { setExpanded(false); }, [scopeKey]);

  const collapsible = scopeMode !== 'daily' && scopeNames.length > COLLAPSE_THRESHOLD;
  const clamp = collapsible && !expanded;

  return (
    <View style={[s.wrapper, { backgroundColor: colors.card, borderColor: colors.line }]}>
      <Text style={[s.summary, { color: colors.ink }]}>{summary}</Text>

      {scopeMode === 'daily' ? (
        <>
          {dailyTotal > 0 && (
            <View style={s.progressWrap}>
              <View style={[s.progressTrack, { backgroundColor: colors.goldPale }]}>
                <View
                  style={[
                    s.progressFill,
                    {
                      width: `${Math.min(dailyCurrent / dailyTotal, 1) * 100}%`,
                      backgroundColor: colors.gold,
                      [isRTL ? 'right' : 'left']: 0,
                    },
                  ]}
                />
              </View>
              <Text style={[s.progressLabel, { color: colors.goldDeep }]}>
                {t('common.quizSettingsBar.dailyProgress', { current: dailyCurrent, total: dailyTotal })}
              </Text>
            </View>
          )}
          <Text style={[s.note, { color: colors.inkSoft }]}>{t('common.quizSettingsBar.dailyNote')}</Text>
        </>
      ) : (
        <>
          <View style={[s.chips, { flexDirection: rowDir(isRTL) }, clamp && { maxHeight: ROW_HEIGHT, overflow: 'hidden' }]}>
            {scopeNames.map((name, i) => (
              <Text key={i} style={[s.chip, { color: colors.ink, backgroundColor: colors.paper }]}>{name}</Text>
            ))}
          </View>
          {collapsible && (
            <PressScale style={s.toggle} onPress={() => setExpanded((v) => !v)}>
              <Text style={[s.toggleTxt, { color: colors.goldDeep }]}>
                {expanded
                  ? t('common.quizSettingsBar.showLess')
                  : t('common.quizSettingsBar.showMore', { count: scopeNames.length })}
              </Text>
            </PressScale>
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  summary: {
    fontSize: 13,
    fontFamily: 'PlexArabic-SemiBold',
    textAlign: 'center',
    marginBottom: 8,
  },
  note: { fontSize: 13, textAlign: 'center' },
  progressWrap: { alignSelf: 'stretch', alignItems: 'center', marginBottom: 8 },
  progressTrack: {
    alignSelf: 'stretch',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    // RTL: the fill grows from the right edge (app convention).
    position: 'relative',
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  progressLabel: { fontSize: 12, fontFamily: 'PlexArabic-SemiBold', marginTop: 5 },
  chips: {
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 6,
  },
  chip: {
    fontSize: 12,
    lineHeight: CHIP_LINE,
    paddingHorizontal: 9,
    paddingVertical: CHIP_PAD_V,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  toggle: { marginTop: 6, paddingVertical: 2, paddingHorizontal: 10 },
  toggleTxt: { fontSize: 12, fontFamily: 'PlexArabic-Bold' },
});
