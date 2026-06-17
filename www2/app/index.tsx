import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthChange } from '../src/services/firebase';
import type { User } from 'firebase/auth';

export default function Index() {
  const [user, setUser] = useState<User | null | 'loading'>('loading');
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    const unsub = onAuthChange((u) => setUser(u));
    AsyncStorage.getItem('onboarding_done').then((v) => setOnboardingDone(v === 'true'));
    return unsub;
  }, []);

  if (user === 'loading' || onboardingDone === null) return null;
  if (!onboardingDone) return <Redirect href="/(onboarding)/slides" />;
  if (!user) return <Redirect href="/(auth)" />;
  return <Redirect href="/(app)/home" />;
}
