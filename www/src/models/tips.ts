// Feature-discovery tips shown on the `me` screen — a lightweight nudge
// system so users stumble onto features they might otherwise never find
// (PvP, the friend map, streak freezes, etc). See profileStore's
// tipIndex/lastTipRollDate/rollForTip() for the daily-roll + sequencing logic.

export interface TipDef {
  id: string;      // stable id — never reused or reordered
  i18nKey: string;  // key under the "tips" section of the locale files
}

// Append-only: new tips are always pushed to the end in future releases, so
// an existing user's tipIndex (a position in this array) keeps pointing at
// the right next tip. To retire a tip, blank its i18nKey to '' instead of
// deleting or reordering the entry — rollForTip() skips blank entries.
export const TIPS: TipDef[] = [
  { id: 'sura_quiz',       i18nKey: 'tips.suraQuiz' },
  { id: 'pvp_ghost_race',  i18nKey: 'tips.pvpGhostRace' },
  { id: 'friend_map',      i18nKey: 'tips.friendMap' },
  { id: 'streak_freeze',   i18nKey: 'tips.streakFreeze' },
  { id: 'daily_quiz',      i18nKey: 'tips.dailyQuiz' },
  { id: 'language_switch', i18nKey: 'tips.languageSwitch' },
];

// Chance a tip is shown at all on a given day's roll (see rollForTip()).
export const TIP_SHOW_CHANCE = 0.3;
