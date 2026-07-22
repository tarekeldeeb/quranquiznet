// Light/dark segmented switcher — same two-pill shape as the league screen's
// today/yesterday/month tabs, so it reads as the app's one "selector" idiom
// rather than a one-off control. Fully controlled (value + onChange) so it
// carries no store dependency of its own — Settings wires it to
// profileStore's themeMode, but any other screen could reuse it with its own
// state just as easily.
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme, radii, ThemeMode } from '../theme/tokens';
import { useDirection, rowDir } from '../theme/direction';
import PressScale from './PressScale';

interface Props {
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}

export default function ThemeToggle({ value, onChange }: Props) {
  const { t } = useTranslation();
  const { isRTL } = useDirection();
  const { colors } = useTheme();

  const options: { mode: ThemeMode; labelKey: 'common.themeToggle.light' | 'common.themeToggle.dark'; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { mode: 'light', labelKey: 'common.themeToggle.light', icon: 'sunny' },
    { mode: 'dark', labelKey: 'common.themeToggle.dark', icon: 'moon' },
  ];

  return (
    <View style={[s.wrap, { backgroundColor: colors.goldPale, flexDirection: rowDir(isRTL) }]}>
      {options.map((opt) => {
        const active = value === opt.mode;
        const label = t(opt.labelKey);
        return (
          <PressScale
            key={opt.mode}
            style={[s.btn, active && { backgroundColor: colors.navy }, { flexDirection: rowDir(isRTL) }]}
            onPress={() => onChange(opt.mode)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
          >
            <Ionicons name={opt.icon} size={14} color={active ? '#fff' : colors.inkSoft} />
            <Text style={[s.txt, { color: active ? '#fff' : colors.inkSoft }]}>{label}</Text>
          </PressScale>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { borderRadius: radii.md, padding: 3, gap: 3 },
  btn: {
    alignItems: 'center', gap: 5,
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: radii.sm,
  },
  txt: { fontSize: 12, fontFamily: 'PlexArabic-SemiBold' },
});
