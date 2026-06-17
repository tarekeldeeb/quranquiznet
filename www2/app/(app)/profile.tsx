// Profile screen — mirrors www/profile/tab-profile.html + firebasecontrol.js
import { useEffect, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { onAuthChange, signInAnon, signInGoogle, signInFacebook, signOut, fetchRemoteProfile, pushProfile } from '../../src/services/firebase';
import { useProfileStore } from '../../src/stores/profileStore';
import type { User } from 'firebase/auth';

function ProgressBar({ label, pct }: { label: string; pct: number }) {
  const n = parseFloat(pct.toString()) || 0;
  return (
    <View style={p.barContainer}>
      <Text style={p.barLabel}>{label}</Text>
      <View style={p.barTrack}>
        <View style={[p.barFill, { width: `${n}%` }]} />
      </View>
      <Text style={p.barPct}>{pct}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const profile = useProfileStore();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthChange(async (u) => {
      setUser(u);
      if (u && !u.isAnonymous) {
        profile.setSocial({
          uid: u.uid,
          displayName: u.displayName ?? undefined,
          photoURL: u.photoURL ?? undefined,
          email: u.email ?? undefined,
          isAnonymous: false,
        });
        // sync profile with Firebase
        const remote = await fetchRemoteProfile(u.uid);
        if (remote) await profile.syncTo(remote as Parameters<typeof profile.syncTo>[0]);
        await pushProfile(u.uid, {
          uid: profile.uid,
          lastSeed: profile.lastSeed,
          lastSync: Date.now(),
          level: profile.level,
          specialEnabled: profile.specialEnabled,
          scores: profile.scores,
          parts: profile.parts,
        });
      } else if (u?.isAnonymous) {
        profile.setSocial({ uid: u.uid, displayName: 'مجهول(ة)', isAnonymous: true });
      }
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignOut() {
    Alert.alert('تسجيل الخروج', 'هل تريد تسجيل الخروج؟', [
      { text: 'لا', style: 'cancel' },
      { text: 'نعم', style: 'destructive', onPress: async () => { await signOut(); } },
    ]);
  }

  const photoURL = user?.isAnonymous
    ? require('../../assets/images/app-icon.png')
    : { uri: user?.photoURL ?? '' };

  const pctStudy = profile.getPercentTotalStudy();
  const pctRatio = profile.getPercentTotalRatio();
  const goodParts = profile.getTopGoodParts();
  const badParts  = profile.getTopBadParts();

  if (!user) {
    return (
      <SafeAreaView style={p.container} edges={['bottom']}>
        <View style={p.loginBox}>
          <Text style={p.loginTitle}>برجاء تسجيل الدخول</Text>
          <Text style={p.loginBody}>
            تسجيل دخولك لشبكة اختبار القرآن يمكّنك من التفاعل مع أهل القرآن والاشتراك
            بالاختبارات اليومية. كما أنه يحفظ ملفك على الشبكة.
          </Text>
          <View style={p.btnRow}>
            <TouchableOpacity style={[p.btn, p.btnFb]} onPress={() => signInFacebook()}>
              <Text style={p.btnTxt}>فيسبوك</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[p.btn, p.btnGoogle]} onPress={() => signInGoogle()}>
              <Text style={p.btnTxt}>جوجل</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[p.btn, p.btnAnon]} onPress={() => signInAnon()}>
              <Text style={[p.btnTxt, { color: '#555' }]}>مجهول</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={p.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={p.scroll}>
        {/* Avatar + name */}
        <View style={p.header}>
          <Image source={photoURL} style={p.avatar} />
          <Text style={p.name}>{user.displayName ?? 'مجهول(ة)'}</Text>
          {!user.isAnonymous && (
            <TouchableOpacity style={p.signOutBtn} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={20} color="#c0392b" />
            </TouchableOpacity>
          )}
        </View>

        {/* Progress bars */}
        <View style={p.section}>
          <ProgressBar label="كم الحفظ" pct={pctStudy as unknown as number} />
          <ProgressBar label="صحة الحفظ" pct={pctRatio as unknown as number} />
        </View>

        {/* Anonymous upgrade prompt */}
        {user.isAnonymous && (
          <View style={p.anonBox}>
            <View style={p.btnRow}>
              <TouchableOpacity style={[p.btn, p.btnFb]} onPress={() => signInFacebook()}>
                <Text style={p.btnTxt}>فيسبوك</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[p.btn, p.btnGoogle]} onPress={() => signInGoogle()}>
                <Text style={p.btnTxt}>جوجل</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Good / Bad suras */}
        <View style={p.twoCol}>
          <View style={p.col}>
            <Text style={p.colHeader}>حفظ ضعيف 🚩</Text>
            {badParts.map((n, i) => <Text key={i} style={p.partItem}>{n}</Text>)}
          </View>
          <View style={p.col}>
            <Text style={p.colHeader}>حفظ جيد ❤️</Text>
            {goodParts.map((n, i) => <Text key={i} style={p.partItem}>{n}</Text>)}
          </View>
        </View>

        {/* Action buttons */}
        <TouchableOpacity style={p.actionBtn} onPress={() => router.push('/(app)/study')}>
          <Ionicons name="toggle-outline" size={18} color="#fff" />
          <Text style={p.actionBtnTxt}> تعديل السور</Text>
        </TouchableOpacity>
        <View style={p.btnRow}>
          <TouchableOpacity style={[p.actionBtn, { flex: 1, backgroundColor: '#0d2d4e' }]} onPress={() => router.push('/(app)/quiz')}>
            <Ionicons name="barcode-outline" size={18} color="#fff" />
            <Text style={p.actionBtnTxt}> اختبار فردي</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const p = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#edf1f5' },
  scroll: { padding: 16, gap: 16 },
  header: { alignItems: 'center', gap: 8, paddingVertical: 16, position: 'relative' },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#0d2d4e' },
  name: { fontSize: 18, fontWeight: '700', color: '#0d2d4e' },
  signOutBtn: { position: 'absolute', top: 16, left: 0 },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  barContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 80, fontSize: 12, color: '#555', textAlign: 'right' },
  barTrack: { flex: 1, height: 10, backgroundColor: '#ecf0f1', borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#0d2d4e', borderRadius: 5 },
  barPct: { width: 36, fontSize: 12, color: '#0d2d4e', fontWeight: '700' },
  anonBox: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  twoCol: { flexDirection: 'row', gap: 12 },
  col: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, gap: 6 },
  colHeader: { fontSize: 13, fontWeight: '700', textAlign: 'right', color: '#0d2d4e', borderBottomWidth: 1, borderColor: '#eee', paddingBottom: 6 },
  partItem: { fontSize: 12, color: '#444', textAlign: 'right' },
  actionBtn: { backgroundColor: '#0d2d4e', borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  actionBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnRow: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnFb: { backgroundColor: '#3b5998' },
  btnGoogle: { backgroundColor: '#dd4b39' },
  btnAnon: { backgroundColor: '#ecf0f1' },
  btnTxt: { color: '#fff', fontWeight: '700' },
  loginBox: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  loginTitle: { fontSize: 18, fontWeight: '700', textAlign: 'right', color: '#0d2d4e' },
  loginBody: { fontSize: 14, color: '#444', textAlign: 'right', lineHeight: 22 },
});
