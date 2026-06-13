import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { I18nManager, ActivityIndicator, View, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { initDb } from '../src/db/initDb';
import { getFirebaseApp } from '../src/services/firebase';
import { useProfileStore } from '../src/stores/profileStore';

// Force RTL layout for Arabic
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

// Initialize Firebase eagerly
getFirebaseApp();

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [dbProgress, setDbProgress] = useState(0);
  const loadProfile = useProfileStore((s) => s.load);

  const [fontsLoaded] = useFonts({
    'AmiriQuranColored': require('../assets/fonts/AmiriQuranColored.woff2'),
    'Amiri-Regular': require('../assets/fonts/Amiri-Regular.woff2'),
  });

  useEffect(() => {
    (async () => {
      await loadProfile();
      await initDb((pct) => setDbProgress(pct));
      setDbReady(true);
    })();
  }, []);

  if (!dbReady || !fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a5276', gap: 16 }}>
          <ActivityIndicator size="large" color="#fff" />
          {dbProgress > 0 && dbProgress < 1 && (
            <Text style={{ color: '#fff', fontSize: 13, opacity: 0.8 }}>
              تحميل البيانات {Math.round(dbProgress * 100)}٪
            </Text>
          )}
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
