// Light/dark segmented switcher — same two-pill shape as the league screen's
// today/yesterday/month tabs, so it reads as the app's one "selector" idiom
// rather than a one-off control. Fully controlled (value + onChange) so it
// carries no store dependency of its own — Settings wires it to
// profileStore's themeMode, but any other screen could reuse it with its own
// state just as easily.
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, radii, ThemeMode } from '../theme/tokens';
import PressScale from './PressScale';

const OPTIONS: { mode: ThemeMode; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { mode: 'light', label: 'فاتح', icon: 'sunny' },
  { mode: 'dark', label: 'داكن', icon: 'moon' },
];

interface Props {
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}

export default function ThemeToggle({ value, onChange }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[s.wrap, { backgroundColor: colors.goldPale }]}>
      {OPTIONS.map((opt) => {
        const active = value === opt.mode;
        return (
          <PressScale
            key={opt.mode}
            style={[s.btn, active && { backgroundColor: colors.navy }]}
            onPress={() => onChange(opt.mode)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
          >
            <Ionicons name={opt.icon} size={14} color={active ? '#fff' : colors.inkSoft} />
            <Text style={[s.txt, { color: active ? '#fff' : colors.inkSoft }]}>{opt.label}</Text>
          </PressScale>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row-reverse', borderRadius: radii.md, padding: 3, gap: 3 },
  btn: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 5,
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: radii.sm,
  },
  txt: { fontSize: 12, fontFamily: 'PlexArabic-SemiBold' },
});
