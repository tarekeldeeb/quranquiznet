import { useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const { width: SW } = Dimensions.get('window');

const SLIDES = [
  {
    icon: '📖',
    title: 'اختبر حفظك',
    body: 'تنافس مع حفاظ القرآن حول العالم',
  },
  {
    icon: '❓',
    title: 'كيف يعمل؟',
    body: 'يظهر لك مقطع من آية، اختر الكلمة التالية الصحيحة',
  },
  {
    icon: '⭐',
    title: 'التحدي اليومي',
    body: '10 أسئلة يومياً بتوقيت، تنافس على الترتيب',
  },
];

export default function SlidesScreen() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const listRef = useRef<FlatList>(null);

  function goNext() {
    if (current < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: current + 1, animated: true });
      setCurrent(current + 1);
    } else {
      router.replace('/(onboarding)/setup');
    }
  }

  function skip() {
    router.replace('/(onboarding)/setup');
  }

  return (
    <SafeAreaView style={s.container}>
      <TouchableOpacity style={s.skipBtn} onPress={skip}>
        <Text style={s.skipTxt}>تخطي</Text>
      </TouchableOpacity>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={s.slide}>
            <Text style={s.icon}>{item.icon}</Text>
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.body}>{item.body}</Text>
          </View>
        )}
      />

      <View style={s.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[s.dot, i === current && s.dotActive]} />
        ))}
      </View>

      <TouchableOpacity style={s.nextBtn} onPress={goNext}>
        <Text style={s.nextTxt}>
          {current < SLIDES.length - 1 ? 'التالي' : 'ابدأ'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d2d4e', alignItems: 'center' },
  skipBtn: { alignSelf: 'flex-start', padding: 16 },
  skipTxt: { color: '#9bbdd4', fontSize: 14 },
  slide: {
    width: SW,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 20,
  },
  icon: { fontSize: 72 },
  title: { fontSize: 28, fontWeight: '700', color: '#fff', textAlign: 'center' },
  body: { fontSize: 16, color: '#9bbdd4', textAlign: 'center', lineHeight: 26 },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { backgroundColor: '#f39c12', width: 24 },
  nextBtn: {
    backgroundColor: '#f39c12',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 30,
    marginBottom: 32,
  },
  nextTxt: { fontSize: 18, fontWeight: '700', color: '#0d2d4e' },
});
