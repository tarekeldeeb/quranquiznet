// PvP journey screen — the world-map counterpart of me.tsx's lifetime-score
// rank ladder (RankSheet): profile.pvp.points → current city on the map →
// the full 20-city ladder below it. One-way progress (see pvpTiers.ts) — a
// loss never moves the avatar back.
import { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import JourneyMap from '../../src/components/JourneyMap';
import PressScale from '../../src/components/PressScale';
import { useProfileStore } from '../../src/stores/profileStore';
import { getPvpTierInfo, getCityLadder, cityName, type PvpCityLadderEntry } from '../../src/models/pvpTiers';
import { useTheme, radii } from '../../src/theme/tokens';
import { useDirection, rowDir, alignDir, mirror } from '../../src/theme/direction';

const TIER_EMOJI: Record<string, string> = {
  bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎', hafizGold: '🏆',
};

export default function PvpJourneyScreen() {
  const { t } = useTranslation();
  const { isRTL } = useDirection();
  const { colors } = useTheme();
  const router = useRouter();
  const profile = useProfileStore();

  const points = profile.pvp.points;
  const tierInfo = useMemo(() => getPvpTierInfo(points), [points]);
  const ladder = useMemo(() => getCityLadder(points), [points]);
  const nextCityLabel = tierInfo.nextCity ? cityName(tierInfo.nextCity.id) : null;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.paper }]} edges={['top', 'bottom']}>
      <View style={[s.header, { borderColor: colors.line, flexDirection: rowDir(isRTL) }]}>
        <PressScale onPress={() => router.back()} hitSlop={10} style={s.backBtn}>
          <Ionicons name={mirror(isRTL, 'chevron-back', 'chevron-forward')} size={22} color={colors.ink} />
        </PressScale>
        <Text style={[s.title, { color: colors.ink, fontFamily: 'Amiri-Regular' }]}>{t('pvpJourney.title')}</Text>
        <Text style={s.headerEmoji}>{TIER_EMOJI[tierInfo.tier]}</Text>
      </View>

      <FlatList
        data={ladder}
        keyExtractor={(item) => item.city.id}
        contentContainerStyle={s.list}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListHeaderComponent={
          <View style={s.mapSection}>
            <JourneyMap
              currentIndex={tierInfo.city.index}
              avatarUri={profile.social.photoURL}
              colors={colors}
            />
            <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
              <Text style={[s.summaryTitle, { color: colors.ink, textAlign: alignDir(isRTL) }]}>
                {tierInfo.tierTitle} · {tierInfo.cityName}
              </Text>
              <Text style={[s.summarySub, { color: colors.inkSoft, textAlign: alignDir(isRTL) }]}>
                {tierInfo.journeyComplete || !nextCityLabel
                  ? t('pvpJourney.complete')
                  : t('pvpJourney.toNextCity', { count: tierInfo.pointsToNextCity, cityName: nextCityLabel })}
              </Text>
              <View style={[s.track, { backgroundColor: colors.goldPale }]}>
                <View style={[s.fill, { width: `${tierInfo.progress * 100}%`, backgroundColor: colors.gold, [isRTL ? 'right' : 'left']: 0 }]} />
              </View>
            </View>
          </View>
        }
        renderItem={({ item }: { item: PvpCityLadderEntry }) => (
          <View
            style={[
              s.row,
              { backgroundColor: colors.card, borderColor: colors.line, flexDirection: rowDir(isRTL) },
              !item.reached && { opacity: 0.55 },
              item.current && { borderColor: colors.gold, borderWidth: 1.5 },
            ]}
          >
            <Text style={s.rowEmoji}>{TIER_EMOJI[item.city.tier]}</Text>
            <View style={[s.rowInfo, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
              <Text style={[s.rowName, { color: colors.ink, textAlign: alignDir(isRTL) }]}>{item.cityName}</Text>
              <Text style={[s.rowSub, { color: colors.inkSoft, textAlign: alignDir(isRTL) }]}>{item.tierTitle}</Text>
            </View>
            {item.current ? (
              <View style={[s.nowBadge, { backgroundColor: colors.gold }]}>
                <Text style={[s.nowTxt, { color: colors.navy }]}>{t('pvpJourney.here')}</Text>
              </View>
            ) : item.reached ? (
              <Ionicons name="checkmark-circle" size={18} color={colors.gold} />
            ) : null}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    alignItems: 'center', padding: 16, gap: 8, borderBottomWidth: 1,
  },
  backBtn: { padding: 2 },
  title: { flex: 1, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  headerEmoji: { fontSize: 20 },
  list: { padding: 12 },
  mapSection: { gap: 12, marginBottom: 16 },
  summaryCard: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 6 },
  summaryTitle: { fontSize: 15, fontFamily: 'PlexArabic-Bold' },
  summarySub: { fontSize: 12.5 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', position: 'relative' },
  fill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3 },
  row: {
    alignItems: 'center', gap: 10, padding: 10, borderRadius: radii.md, borderWidth: 1,
  },
  rowEmoji: { fontSize: 18 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontFamily: 'PlexArabic-SemiBold' },
  rowSub: { fontSize: 11, marginTop: 1 },
  nowBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.pill },
  nowTxt: { fontSize: 10.5, fontFamily: 'PlexArabic-Bold' },
});
