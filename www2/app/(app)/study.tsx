// Study screen — mirrors www/study/tab-study.html + studyCtrl.js
import { View, Text, FlatList, Switch, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useProfileStore, CORRECT_RATIO_RANGE } from '../../src/stores/profileStore';

function getPartIcon(range: number): { name: React.ComponentProps<typeof Ionicons>['name']; color: string } {
  switch (range) {
    case CORRECT_RATIO_RANGE.HIGH: return { name: 'heart',        color: '#27ae60' };
    case CORRECT_RATIO_RANGE.MID:  return { name: 'heart-outline', color: '#f39c12' };
    case CORRECT_RATIO_RANGE.LOW:  return { name: 'flag',          color: '#c0392b' };
    default:                       return { name: 'help-circle-outline', color: '#bdc3c7' };
  }
}

export default function StudyScreen() {
  const profile = useProfileStore();

  function togglePart(index: number) {
    const parts = [...profile.parts];
    parts[index] = { ...parts[index], checked: !parts[index].checked };
    useProfileStore.setState({ parts });
    profile.saveParts();
  }

  function selectAll() {
    const tog = !profile.parts[1]?.checked;
    const parts = profile.parts.map((p, i) => (i === 0 ? p : { ...p, checked: tog }));
    useProfileStore.setState({ parts });
    profile.saveParts();
  }

  function selectGood() {
    const parts = profile.parts.map((p, i) => ({
      ...p,
      checked: profile.getCorrectRatioRange(i) === CORRECT_RATIO_RANGE.HIGH ||
                profile.getCorrectRatioRange(i) === CORRECT_RATIO_RANGE.MID,
    }));
    useProfileStore.setState({ parts });
    profile.saveParts();
  }

  function selectWeak() {
    const parts = profile.parts.map((p, i) => ({
      ...p,
      checked: profile.getCorrectRatioRange(i) === CORRECT_RATIO_RANGE.LOW,
    }));
    useProfileStore.setState({ parts });
    profile.saveParts();
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* Filter action bar */}
      <View style={s.actionBar}>
        <TouchableOpacity style={s.actionBtn} onPress={selectAll}>
          <Ionicons name="checkmark" size={18} color="#0d2d4e" />
          <Text style={s.actionTxt}> الكل</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={selectGood}>
          <Ionicons name="heart" size={18} color="#27ae60" />
          <Text style={s.actionTxt}> الجيد</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={selectWeak}>
          <Ionicons name="flag" size={18} color="#c0392b" />
          <Text style={s.actionTxt}> الضعيف</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={profile.parts}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index }) => {
          const { name: iconName, color: iconColor } = getPartIcon(profile.getCorrectRatioRange(index));
          const correct = item.numCorrect[1] + item.numCorrect[2] + item.numCorrect[3];
          const questions = item.numQuestions[1] + item.numQuestions[2] + item.numQuestions[3];
          return (
            <View style={s.row}>
              <Switch
                value={item.checked}
                onValueChange={() => togglePart(index)}
                trackColor={{ false: '#ccc', true: '#0d2d4e' }}
                thumbColor={item.checked ? '#fff' : '#f4f3f4'}
              />
              <Ionicons name={iconName} size={18} color={iconColor} style={s.icon} />
              <View style={s.info}>
                <Text style={s.partName}>{item.name}</Text>
                <Text style={s.partSub}>
                  إجاباتك الصحيحة {correct} من {questions}
                </Text>
              </View>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={s.sep} />}
        contentContainerStyle={s.list}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#edf1f5' },
  actionBar: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#ddd', gap: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center' },
  actionTxt: { fontSize: 14, color: '#555' },
  list: { paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  icon: { marginHorizontal: 2 },
  info: { flex: 1, alignItems: 'flex-end' },
  partName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', textAlign: 'right' },
  partSub: { fontSize: 11, color: '#888', textAlign: 'right', marginTop: 2 },
  sep: { height: 1, backgroundColor: '#f0f0f0' },
});
