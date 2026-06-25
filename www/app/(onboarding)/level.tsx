import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfileStore } from '../../src/stores/profileStore';

export default function LevelScreen() {
  const router = useRouter();
  const profile = useProfileStore();
  const [selected, setSelected] = useState(1);

  async function confirm() {
    useProfileStore.setState({ level: selected });
    await profile.saveSettings();
    await AsyncStorage.setItem('onboarding_done', 'true');
    router.replace('/(auth)');
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>اختر مستواك</Text>
        <Text style={s.subtitle}>يمكنك تغيير هذا لاحقاً من الإعدادات</Text>

        {profile.levels.map((lvl) => (
          <TouchableOpacity
            key={lvl.value}
            style={[
              s.card,
              selected === lvl.value && s.cardSelected,
              lvl.disabled && s.cardDisabled,
            ]}
            onPress={() => !lvl.disabled && setSelected(lvl.value)}
            activeOpacity={lvl.disabled ? 1 : 0.75}
          >
            <View style={[s.radio, selected === lvl.value && s.radioSelected]}>
              {selected === lvl.value && <View style={s.radioDot} />}
            </View>
            <View style={s.cardText}>
              <Text style={[s.levelName, lvl.disabled && s.disabledTxt]}>{lvl.text}</Text>
              <Text style={s.levelComment}>{lvl.comment}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={s.confirmBtn} onPress={confirm}>
          <Text style={s.confirmTxt}>ابدأ الآن</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#edf1f5' },
  scroll: { padding: 20, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#0d2d4e', textAlign: 'right' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'right', marginBottom: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    boxShadow: '0px 0px 4px rgba(0,0,0,0.06)',
    elevation: 2,
  },
  cardSelected: { borderColor: '#0d2d4e' },
  cardDisabled: { opacity: 0.45 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#aaa',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioSelected: { borderColor: '#0d2d4e' },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#0d2d4e' },
  cardText: { flex: 1, alignItems: 'flex-end' },
  levelName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', textAlign: 'right' },
  levelComment: { fontSize: 12, color: '#777', textAlign: 'right', marginTop: 3 },
  disabledTxt: { color: '#aaa' },
  confirmBtn: {
    backgroundColor: '#0d2d4e',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  confirmTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
