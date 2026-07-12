// Settings screen — level, special questions, version, sign-out. Reached from
// Home via the gear icon in the header (see (app)/me.tsx) instead of living
// inline on Home, which used to do five jobs at once.
import { useState } from 'react';
import { View, Text, Switch, Alert, StyleSheet, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useProfileStore } from '../../src/stores/profileStore';
import { signOut } from '../../src/services/firebase';
import { useTheme, radii } from '../../src/theme/tokens';
import PressScale from '../../src/components/PressScale';

const APP_VERSION = Constants.expoConfig?.version ?? '';

function notify(title: string, msg: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${msg}`);
    return;
  }
  Alert.alert(title, msg);
}

export default function SettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const profile = useProfileStore();
  const social = profile.social;
  const [signingOut, setSigningOut] = useState(false);

  const SPECIAL_MIN_LEVEL = 2;
  const specialEditable = profile.level >= SPECIAL_MIN_LEVEL;

  function setLevel(value: number) {
    const patch: { level: number; specialEnabled?: boolean } = { level: value };
    if (value < SPECIAL_MIN_LEVEL) patch.specialEnabled = false;
    useProfileStore.setState(patch);
    profile.saveSettings();
  }

  function toggleSpecial(v: boolean) {
    if (!specialEditable) return;
    useProfileStore.setState({ specialEnabled: v });
    profile.saveSettings();
  }

  async function performSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } catch (e) {
      console.error(e);
    }
    await profile.delete().catch(console.error);
    router.replace('/(auth)');
  }

  function handleSignOut() {
    const msg = 'سيتم مسح بيانات التطبيق المحلية. هل تريد المتابعة؟';
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || window.confirm(`تسجيل الخروج\n\n${msg}`)) performSignOut();
      return;
    }
    Alert.alert('تسجيل الخروج', msg, [
      { text: 'لا', style: 'cancel' },
      { text: 'نعم', style: 'destructive', onPress: performSignOut },
    ]);
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.paper }]} edges={['bottom']}>
      <ScrollView style={s.scrollView} contentContainerStyle={s.scroll}>
        {/* Level selector */}
        <View style={[s.section, { backgroundColor: colors.card }]}>
          <Text style={[s.sectionHeader, { color: colors.navy, backgroundColor: colors.paper, borderColor: colors.line }]}>
            مستوى الاختبار: {profile.levels[profile.level]?.text}
          </Text>
          {profile.levels.map((lvl) => (
            <PressScale
              key={lvl.value}
              style={[s.levelRow, { borderColor: colors.line }, lvl.disabled && s.disabled]}
              onPress={() => !lvl.disabled && setLevel(lvl.value)}
              disabled={lvl.disabled}
            >
              <View style={s.levelLeft}>
                <View style={[s.radio, { borderColor: colors.navy }]}>
                  {profile.level === lvl.value && <View style={[s.radioDot, { backgroundColor: colors.navy }]} />}
                </View>
              </View>
              <View style={s.levelRight}>
                <Text style={[s.levelName, { color: colors.ink }, lvl.disabled && { color: colors.inkSoft }]}>{lvl.text}</Text>
                <Text style={[s.levelComment, { color: colors.inkSoft }]}>{lvl.comment}</Text>
              </View>
            </PressScale>
          ))}
        </View>

        {/* Special questions toggle */}
        <View style={[s.section, { backgroundColor: colors.card }]}>
          <Text style={[s.sectionHeader, { color: colors.navy, backgroundColor: colors.paper, borderColor: colors.line }]}>الأسئلة الخاصة</Text>
          <View style={s.toggleRow}>
            <View style={s.toggleInfo}>
              <Text style={[s.toggleLabel, { color: colors.ink }]}>تفعيل الأسئلة عن اسم السورة ورقم الآية</Text>
              {!specialEditable && (
                <Text style={[s.toggleHint, { color: colors.inkSoft }]}>من المستوى الثانوي فأعلى</Text>
              )}
            </View>
            <Switch
              value={specialEditable && profile.specialEnabled}
              onValueChange={toggleSpecial}
              disabled={!specialEditable}
              trackColor={{ false: colors.line, true: colors.navy }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Account */}
        {!social.isAnonymous && social.uid && (
          <PressScale
            style={[s.section, s.signOutRow, { backgroundColor: colors.card }]}
            onPress={handleSignOut}
            disabled={signingOut}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.wrong} />
            <Text style={[s.signOutTxt, { color: colors.wrong }]}>تسجيل الخروج</Text>
          </PressScale>
        )}

        <Text style={[s.version, { color: colors.inkSoft }]}>الإصدار {APP_VERSION}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scroll: { padding: 16, gap: 16, paddingBottom: 32 },
  section: {
    borderRadius: radii.md, overflow: 'hidden',
    boxShadow: '0px 0px 4px rgba(0,0,0,0.05)', elevation: 2,
  },
  sectionHeader: {
    fontSize: 14, fontFamily: 'PlexArabic-Bold', textAlign: 'right',
    padding: 14, borderBottomWidth: 1,
  },
  levelRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12, borderBottomWidth: 1 },
  disabled: { opacity: 0.5 },
  levelLeft: { paddingTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  levelRight: { flex: 1, alignItems: 'flex-end' },
  levelName: { fontSize: 15, fontFamily: 'PlexArabic-SemiBold', textAlign: 'right' },
  levelComment: { fontSize: 12, textAlign: 'right', marginTop: 2 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  toggleInfo: { flex: 1, alignItems: 'flex-end' },
  toggleLabel: { fontSize: 14, textAlign: 'right' },
  toggleHint: { fontSize: 11, textAlign: 'right', marginTop: 2 },
  signOutRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14 },
  signOutTxt: { fontSize: 14, fontFamily: 'PlexArabic-SemiBold' },
  version: { textAlign: 'center', fontSize: 12, paddingBottom: 16 },
});
