import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { I18nManager, ActivityIndicator, View, Text, Image } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { initDb } from '../src/db/initDb';
import { getFirebaseApp } from '../src/services/firebase';
import { useProfileStore } from '../src/stores/profileStore';

const appIcon = require('../assets/images/app-icon.png');

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!dbReady || !fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d2d4e', gap: 20 }}>
          <Image source={appIcon} style={{ width: 96, height: 96, borderRadius: 20 }} />
          <ActivityIndicator size="large" color="#f39c12" />
          {dbProgress > 0 && dbProgress < 1 && (
            <Text style={{ color: '#9bbdd4', fontSize: 13 }}>
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
