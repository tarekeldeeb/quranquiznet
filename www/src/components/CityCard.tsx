// City "fact card" for the PvP journey map — opened by tapping the current
// city's pill under the avatar in JourneyMap.tsx. Founded year is city-
// specific; population/Muslim % are the city's *country* figures (see
// cityFacts.ts for why) — hence the "City, Country" subtitle giving that
// context instead of leaving the big population number unexplained.
import { Modal, Pressable, View, Text, Image, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import PressScale from './PressScale';
import { CITY_FACTS, muslimPopulation, formatFoundedYear, formatCount, formatPercent } from '../models/cityFacts';
import { CITY_IMAGES } from '../models/cityImages';
import { cityName, type PvpCity } from '../models/pvpTiers';
import { useDirection, rowDir } from '../theme/direction';
import type { ThemeColors } from '../theme/tokens';

interface Props {
  city: PvpCity | null;
  visible: boolean;
  onClose: () => void;
  colors: Pick<ThemeColors, 'card' | 'ink' | 'inkSoft' | 'line' | 'gold' | 'paper'>;
}

export default function CityCard({ city, visible, onClose, colors }: Props) {
  const { t } = useTranslation();
  const { isRTL } = useDirection();
  if (!city) return null;
  const facts = CITY_FACTS[city.id];

  const stats = [
    { label: t('pvpJourney.cityCard.founded'), value: formatFoundedYear(facts.foundedYear) },
    { label: t('pvpJourney.cityCard.population'), value: formatCount(facts.population) },
    { label: t('pvpJourney.cityCard.muslimPopulation'), value: formatCount(muslimPopulation(city.id)) },
    { label: t('pvpJourney.cityCard.muslimPercent'), value: formatPercent(facts.muslimPercent) },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.bg} onPress={onClose}>
        <View
          style={[s.box, { backgroundColor: colors.card, borderColor: colors.line }]}
          onStartShouldSetResponder={() => true}
        >
          <Image source={CITY_IMAGES[city.id]} style={s.photo} resizeMode="cover" />

          <Text style={[s.name, { color: colors.ink }]}>
            {t('pvpJourney.cityCard.location', {
              city: cityName(city.id),
              country: t(`pvpJourney.country.${facts.country}`),
            })}
          </Text>

          <View style={s.stats}>
            {stats.map((row, i) => (
              <View
                key={row.label}
                style={[
                  s.statRow,
                  { borderColor: colors.line, flexDirection: rowDir(isRTL) },
                  i === stats.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <Text style={[s.statLabel, { color: colors.inkSoft }]}>{row.label}</Text>
                <Text style={[s.statValue, { color: colors.ink }]}>{row.value}</Text>
              </View>
            ))}
          </View>

          <PressScale style={[s.closeBtn, { backgroundColor: colors.gold }]} onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.ink} />
          </PressScale>
        </View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  box: {
    borderRadius: 16, borderWidth: 1, padding: 20, width: '100%', maxWidth: 340, alignItems: 'center',
  },
  photo: {
    width: '100%', height: 150, borderRadius: 14, marginBottom: 12,
  },
  name: { fontSize: 18, fontFamily: 'PlexArabic-Bold', textAlign: 'center', marginBottom: 14 },
  stats: { width: '100%' },
  statRow: {
    flexDirection: 'row', justifyContent: 'space-between', width: '100%',
    paddingVertical: 8, borderBottomWidth: 1,
  },
  statLabel: { fontSize: 13, flexShrink: 1 },
  statValue: { fontSize: 13, fontWeight: '700' },
  closeBtn: {
    marginTop: 16, width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
});
