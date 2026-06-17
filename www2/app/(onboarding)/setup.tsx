import { useState } from 'react';
import {
  View, Text, FlatList, Switch, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useProfileStore } from '../../src/stores/profileStore';

export default function SetupScreen() {
  const router = useRouter();
  const profile = useProfileStore();
  const [parts, setParts] = useState(() => profile.parts.map((p) => ({ ...p })));

  function toggle(index: number) {
    if (index === 0) return;
    const next = [...parts];
    next[index] = { ...next[index], checked: !next[index].checked };
    setParts(next);
  }

  function selectAll() {
    setParts(parts.map((p, i) => (i === 0 ? p : { ...p, checked: true })));
  }

  function selectNone() {
    setParts(parts.map((p, i) => (i === 0 ? p : { ...p, checked: false })));
  }

  function selectLast() {
    setParts(parts.map((p, i) => ({
      ...p,
      checked: i === 0 ? true : i >= 45 && i <= 49,
    })));
  }

  async function confirm() {
    useProfileStore.setState({ parts });
    await profile.saveParts();
    router.replace('/(onboarding)/level');
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>ماذا حفظت؟</Text>
        <Text style={s.subtitle}>اختر السور والأجزاء التي حفظتها</Text>
      </View>

      <View style={s.actionRow}>
        <TouchableOpacity style={s.actionBtn} onPress={selectAll}>
          <Text style={s.actionTxt}>الكل</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={selectNone}>
          <Text style={s.actionTxt}>لا شيء</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={selectLast}>
          <Text style={s.actionTxt}>الأخيرة</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={parts}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index }) => (
          <View style={s.row}>
            <Switch
              value={item.checked}
              onValueChange={() => toggle(index)}
              disabled={index === 0}
              trackColor={{ false: '#ccc', true: '#0d2d4e' }}
              thumbColor={item.checked ? '#fff' : '#f4f3f4'}
            />
            <Text style={[s.partName, index === 0 && s.partNameFixed]}>
              {item.name}
            </Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={s.sep} />}
        contentContainerStyle={s.list}
        style={s.flatList}
      />

      <TouchableOpacity style={s.confirmBtn} onPress={confirm}>
        <Text style={s.confirmTxt}>تأكيد واستمر</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#edf1f5' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#0d2d4e', textAlign: 'right' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'right', marginTop: 4 },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d6eaf8',
  },
  actionTxt: { fontSize: 13, fontWeight: '600', color: '#0d2d4e' },
  flatList: { flex: 1 },
  list: { paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  partName: { flex: 1, fontSize: 15, color: '#1a1a1a', textAlign: 'right' },
  partNameFixed: { color: '#0d2d4e', fontWeight: '600' },
  sep: { height: 1, backgroundColor: '#f0f0f0' },
  confirmBtn: {
    backgroundColor: '#0d2d4e',
    margin: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
