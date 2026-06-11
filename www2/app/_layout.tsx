import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { I18nManager, ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
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

  useEffect(() => {
    (async () => {
      await loadProfile();
      await initDb((pct) => setDbProgress(pct));
      setDbReady(true);
    })();
  }, []);

  if (!dbReady) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a5276' }}>
          <ActivityIndicator size="large" color="#fff" />
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
