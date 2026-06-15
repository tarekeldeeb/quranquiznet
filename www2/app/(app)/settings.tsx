// Settings screen — mirrors www/settings/tab-settings.html + settingsCtrl.js
import { View, Text, Switch, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProfileStore } from '../../src/stores/profileStore';

export default function SettingsScreen() {
  const profile = useProfileStore();

  function setLevel(value: number) {
    useProfileStore.setState({ level: value });
    profile.saveSettings();
  }

  function toggleSpecial(v: boolean) {
    useProfileStore.setState({ specialEnabled: v });
    profile.saveSettings();
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Level selector */}
        <View style={s.section}>
          <Text style={s.sectionHeader}>مستوى الاختبار: {profile.levels[profile.level]?.text}</Text>
          {profile.levels.map((lvl) => (
            <TouchableOpacity
              key={lvl.value}
              style={[s.levelRow, lvl.disabled && s.disabled]}
              onPress={() => !lvl.disabled && setLevel(lvl.value)}
              activeOpacity={lvl.disabled ? 1 : 0.7}
            >
              <View style={s.levelLeft}>
                <View style={[s.radio, profile.level === lvl.value && s.radioSelected]}>
                  {profile.level === lvl.value && <View style={s.radioDot} />}
                </View>
              </View>
              <View style={s.levelRight}>
                <Text style={[s.levelName, lvl.disabled && { color: '#aaa' }]}>{lvl.text}</Text>
                <Text style={s.levelComment}>{lvl.comment}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Special questions toggle */}
        <View style={s.section}>
          <Text style={s.sectionHeader}>الأسئلة الخاصة</Text>
          <View style={s.toggleRow}>
            <View style={s.toggleInfo}>
              <Text style={s.toggleLabel}>تفعيل الأسئلة عن اسم السورة ورقم الآية</Text>
            </View>
            <Switch
              value={profile.specialEnabled}
              onValueChange={toggleSpecial}
              trackColor={{ false: '#ccc', true: '#1a5276' }}
              thumbColor={profile.specialEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Version info */}
        <Text style={s.version}>الإصدار {profile.version.app}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  scroll: { padding: 16, gap: 16 },
  section: {
    backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  sectionHeader: {
    fontSize: 14, fontWeight: '700', color: '#1a5276', textAlign: 'right',
    padding: 14, borderBottomWidth: 1, borderColor: '#eee', backgroundColor: '#f8f9fa',
  },
  levelRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  disabled: { opacity: 0.5 },
  levelLeft: { paddingTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#1a5276', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: '#1a5276' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1a5276' },
  levelRight: { flex: 1, alignItems: 'flex-end' },
  levelName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', textAlign: 'right' },
  levelComment: { fontSize: 12, color: '#777', textAlign: 'right', marginTop: 2 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: 14, color: '#1a1a1a', textAlign: 'right' },
  version: { textAlign: 'center', color: '#aaa', fontSize: 12, paddingBottom: 16 },
});
