// Welcome / login screen — mirrors www/templates/ahlan.html + www/profile/firebasecontrol.js
import { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInAnon, signInGoogle, signInFacebook, onAuthChange } from '../../src/services/firebase';

export default function AuthScreen() {
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthChange((user) => {
      if (user) router.replace('/(app)/quiz');
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGoogle() {
    const user = await signInGoogle();
    if (!user) Alert.alert('خطأ', 'تعذر تسجيل الدخول بجوجل');
  }

  async function handleFacebook() {
    const user = await signInFacebook();
    if (!user) Alert.alert('خطأ', 'تعذر تسجيل الدخول بفيسبوك');
  }

  async function handleAnonymous() {
    await signInAnon();
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.center}>
        <Image source={require('../../assets/images/icon.png')} style={s.logo} resizeMode="contain" />
        <Text style={s.title}>شبكة اختبار القرآن</Text>

        <View style={s.card}>
          <Text style={s.cardHeader}>برجاء تسجيل الدخول</Text>
          <Text style={s.cardBody}>
            السلام عليكم، تسجيل دخولك لشبكة اختبار القرآن يمكّنك من التفاعل مع أهل القرآن
            والاشتراك بالاختبارات اليومية. كما أنه يحفظ ملفك على الشبكة مما يمكّنك من استخدام
            عدة أجهزة والوصول لنفس المحتوى.
          </Text>

          <View style={s.buttonRow}>
            <TouchableOpacity style={[s.btn, s.btnFacebook]} onPress={handleFacebook}>
              <Text style={s.btnText}>فيسبوك</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.btnGoogle]} onPress={handleGoogle}>
              <Text style={s.btnText}>جوجل</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.btnAnon]} onPress={handleAnonymous}>
              <Text style={[s.btnText, { color: '#555' }]}>مجهول</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a5276' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logo: { width: 90, height: 90, marginBottom: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '100%',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  cardHeader: { fontSize: 17, fontWeight: '700', textAlign: 'right', marginBottom: 10, color: '#1a5276' },
  cardBody: { fontSize: 14, color: '#444', textAlign: 'right', lineHeight: 22, marginBottom: 20 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnFacebook: { backgroundColor: '#3b5998' },
  btnGoogle:   { backgroundColor: '#dd4b39' },
  btnAnon:     { backgroundColor: '#e0e0e0' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
