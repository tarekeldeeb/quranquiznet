import { useRef } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, ScrollView,
  Switch, Alert, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { signInGoogle, signInFacebook, signOut } from '../../src/services/firebase';
import { useProfileStore, CORRECT_RATIO_RANGE } from '../../src/stores/profileStore';

type BulkAction = 'all' | 'good' | 'weak';

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionHeaderTxt}>{title}</Text>
    </View>
  );
}

function ProgressBar({ label, value }: { label: string; value: string }) {
  const n = parseFloat(value) || 0;
  return (
    <View style={s.barRow}>
      <Text style={s.barLabel}>{label}</Text>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${Math.min(n, 100)}%` }]} />
      </View>
      <Text style={s.barPct}>{value}</Text>
    </View>
  );
}

const DOT_COLOR: Record<number, string> = {
  [CORRECT_RATIO_RANGE.HIGH]:  '#27ae60',
  [CORRECT_RATIO_RANGE.MID]:   '#f39c12',
  [CORRECT_RATIO_RANGE.LOW]:   '#e74c3c',
  [CORRECT_RATIO_RANGE.EMPTY]: '#bdc3c7',
};

export default function MeScreen() {
  const router = useRouter();
  const profile = useProfileStore();
  const listRef = useRef<FlatList>(null);
  // Auth sync is handled by (app)/_layout.tsx — profile.social is always up-to-date here
  const social = profile.social;

  function handleSignOut() {
    Alert.alert(
      'تسجيل الخروج',
      'سيتم مسح بيانات التطبيق المحلية. هل تريد المتابعة؟',
      [
        { text: 'لا', style: 'cancel' },
        {
          text: 'نعم',
          style: 'destructive',
          onPress: () => {
            // Fire-and-forget — navigate immediately, clean up in background
            router.replace('/(auth)');
            signOut().catch(console.error);
            profile.delete().catch(console.error);
          },
        },
      ],
    );
  }

  function togglePart(index: number) {
    if (index === 0) return;
    const parts = [...profile.parts];
    parts[index] = { ...parts[index], checked: !parts[index].checked };
    useProfileStore.setState({ parts });
    profile.saveParts();
  }

  function setLevel(value: number) {
    useProfileStore.setState({ level: value });
    profile.saveSettings();
  }

  function toggleSpecial(v: boolean) {
    useProfileStore.setState({ specialEnabled: v });
    profile.saveSettings();
  }

  function applyBulk(action: BulkAction) {
    const parts = profile.parts.map((p, i) => {
      if (i === 0) return p; // Al-Fatiha always stays checked
      const range = profile.getCorrectRatioRange(i);
      let checked: boolean;
      if (action === 'all') {
        checked = true;
      } else if (action === 'good') {
        checked = range === CORRECT_RATIO_RANGE.HIGH;
      } else {
        checked = range === CORRECT_RATIO_RANGE.LOW || range === CORRECT_RATIO_RANGE.MID || range === CORRECT_RATIO_RANGE.EMPTY;
      }
      return { ...p, checked };
    });
    useProfileStore.setState({ parts });
    profile.saveParts();
  }

  const allParts = profile.parts.map((p, i) => ({ part: p, index: i, range: profile.getCorrectRatioRange(i) }));

  const photoSource = social.photoURL
    ? { uri: social.photoURL }
    : require('../../assets/images/app-icon.png');

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Section 1: Profile ── */}
        <SectionHeader title="الملف الشخصي" />
        <View style={s.card}>
          <View style={s.profileHeader}>
            <Image source={photoSource} style={s.avatar} />
            <View style={s.profileInfo}>
              <Text style={s.profileName}>{social.displayName ?? 'مجهول(ة)'}</Text>
              {social.email ? <Text style={s.profileEmail}>{social.email}</Text> : null}
            </View>
            {!social.isAnonymous && social.uid && (
              <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
                <Ionicons name="log-out-outline" size={20} color="#e74c3c" />
              </TouchableOpacity>
            )}
          </View>

          <View style={s.barsSection}>
            <ProgressBar label="كم الحفظ" value={profile.getPercentTotalStudy()} />
            <ProgressBar label="صحة الحفظ" value={profile.getPercentTotalRatio()} />
          </View>

          {social.isAnonymous && (
            <View style={s.anonBox}>
              <Text style={s.anonTxt}>سجّل دخولك لحفظ تقدمك ومزامنة بياناتك</Text>
              <View style={s.anonBtns}>
                <TouchableOpacity style={[s.socialBtn, s.btnGoogle]} onPress={() => signInGoogle()}>
                  <Text style={s.socialBtnTxt}>جوجل</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.socialBtn, s.btnFb]} onPress={() => signInFacebook()}>
                  <Text style={s.socialBtnTxt}>فيسبوك</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── Section 2: Study ── */}
        <SectionHeader title="حفظي" />
        <View style={s.card}>
          <View style={s.filterRow}>
            {([['all', 'تفعيل الكل'], ['good', 'تفعيل الجيد'], ['weak', 'تفعيل الضعيف']] as [BulkAction, string][]).map(([action, label]) => (
              <TouchableOpacity
                key={action}
                style={s.filterBtn}
                onPress={() => applyBulk(action)}
              >
                <Text style={s.filterBtnTxt}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            ref={listRef}
            data={allParts}
            keyExtractor={(item) => String(item.index)}
            scrollEnabled={false}
            renderItem={({ item }) => {
              const { part, index, range } = item;
              const correct = part.numCorrect[1] + part.numCorrect[2] + part.numCorrect[3];
              const questions = part.numQuestions[1] + part.numQuestions[2] + part.numQuestions[3];
              return (
                <View style={s.partRow}>
                  <TouchableOpacity
                    style={s.partPlay}
                    onPress={() => router.push({ pathname: '/(app)/quiz', params: { customPart: String(index), nonce: String(Date.now()) } })}
                  >
                    <Ionicons name="play-circle-outline" size={22} color="#0d2d4e" />
                  </TouchableOpacity>
                  <View style={[s.rangeDot, { backgroundColor: DOT_COLOR[range] }]} />
                  <View style={s.partInfo}>
                    <Text style={s.partName}>{part.name}</Text>
                    <Text style={s.partSub}>{correct} صحيحة من {questions}</Text>
                  </View>
                  <Switch
                    value={part.checked}
                    onValueChange={() => togglePart(index)}
                    disabled={index === 0}
                    trackColor={{ false: '#ccc', true: '#0d2d4e' }}
                    thumbColor={part.checked ? '#fff' : '#f4f3f4'}
                  />
                </View>
              );
            }}
            ItemSeparatorComponent={() => <View style={s.sep} />}
          />
        </View>

        {/* ── Section 3: Settings ── */}
        <SectionHeader title="الإعدادات" />
        <View style={s.card}>
          <Text style={s.settingsSubHeader}>
            مستوى الاختبار: {profile.levels[profile.level]?.text}
          </Text>
          {profile.levels.map((lvl) => (
            <TouchableOpacity
              key={lvl.value}
              style={[s.levelRow, lvl.disabled && s.levelDisabled]}
              onPress={() => !lvl.disabled && setLevel(lvl.value)}
              activeOpacity={lvl.disabled ? 1 : 0.7}
            >
              <View style={[s.radio, profile.level === lvl.value && s.radioSelected]}>
                {profile.level === lvl.value && <View style={s.radioDot} />}
              </View>
              <View style={s.levelText}>
                <Text style={[s.levelName, lvl.disabled && s.disabledTxt]}>{lvl.text}</Text>
                <Text style={s.levelComment}>{lvl.comment}</Text>
              </View>
            </TouchableOpacity>
          ))}

          <View style={s.toggleRow}>
            <View style={s.toggleInfo}>
              <Text style={s.toggleLabel}>الأسئلة الخاصة</Text>
              <Text style={s.toggleSub}>تفعيل أسئلة اسم السورة ورقم الآية</Text>
            </View>
            <Switch
              value={profile.specialEnabled}
              onValueChange={toggleSpecial}
              trackColor={{ false: '#ccc', true: '#0d2d4e' }}
              thumbColor={profile.specialEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>

          <Text style={s.version}>الإصدار {profile.version.app}</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#edf1f5' },
  scroll: { padding: 16, gap: 4, paddingBottom: 32 },

  sectionHeader: { paddingHorizontal: 4, paddingTop: 16, paddingBottom: 6 },
  sectionHeaderTxt: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: '#888', textAlign: 'right', textTransform: 'uppercase' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0px 0px 4px rgba(0,0,0,0.06)',
    elevation: 2,
  },

  // Profile section
  profileHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  avatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#d6eaf8' },
  profileInfo: { flex: 1, alignItems: 'flex-end' },
  profileName: { fontSize: 17, fontWeight: '700', color: '#0d2d4e', textAlign: 'right' },
  profileEmail: { fontSize: 12, color: '#888', textAlign: 'right', marginTop: 2 },
  signOutBtn: { padding: 8 },
  barsSection: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  barRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  barLabel: { width: 72, fontSize: 12, color: '#555', textAlign: 'right' },
  barTrack: { flex: 1, height: 8, backgroundColor: '#ecf0f1', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#0d2d4e', borderRadius: 4 },
  barPct: { width: 38, fontSize: 12, fontWeight: '700', color: '#0d2d4e', textAlign: 'left' },
  anonBox: { borderTopWidth: 1, borderColor: '#f0f0f0', padding: 16, gap: 10 },
  anonTxt: { fontSize: 13, color: '#666', textAlign: 'right' },
  anonBtns: { flexDirection: 'row-reverse', gap: 8 },
  socialBtn: { flex: 1, paddingVertical: 11, borderRadius: 8, alignItems: 'center' },
  btnGoogle: { backgroundColor: '#dd4b39' },
  btnFb: { backgroundColor: '#3b5998' },
  socialBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Study section
  filterRow: {
    flexDirection: 'row-reverse',
    padding: 10,
    gap: 6,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#edf1f5',
    borderWidth: 1,
    borderColor: '#d0d8e4',
  },
  filterBtnTxt: { fontSize: 12, fontWeight: '600', color: '#0d2d4e' },
  partRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  partPlay: { padding: 2 },
  rangeDot: { width: 10, height: 10, borderRadius: 5 },
  partInfo: { flex: 1, alignItems: 'flex-end' },
  partName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', textAlign: 'right' },
  partSub: { fontSize: 11, color: '#888', textAlign: 'right', marginTop: 1 },
  sep: { height: 1, backgroundColor: '#f5f5f5', marginHorizontal: 12 },

  // Settings section
  settingsSubHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0d2d4e',
    textAlign: 'right',
    padding: 14,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  levelRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  levelDisabled: { opacity: 0.5 },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#bbb',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  radioSelected: { borderColor: '#0d2d4e' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0d2d4e' },
  levelText: { flex: 1, alignItems: 'flex-end' },
  levelName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', textAlign: 'right' },
  levelComment: { fontSize: 11, color: '#777', textAlign: 'right', marginTop: 2 },
  disabledTxt: { color: '#bbb' },
  toggleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderTopWidth: 1,
    borderColor: '#f0f0f0',
  },
  toggleInfo: { flex: 1, alignItems: 'flex-end' },
  toggleLabel: { fontSize: 14, color: '#1a1a1a', textAlign: 'right', fontWeight: '600' },
  toggleSub: { fontSize: 11, color: '#888', textAlign: 'right', marginTop: 2 },
  version: { textAlign: 'center', color: '#bbb', fontSize: 11, padding: 14 },
});
