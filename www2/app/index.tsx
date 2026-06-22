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
  // A logged-in user has already been through onboarding — never show the tutorial,
  // even if this browser/session is missing the local `onboarding_done` flag.
  if (user) {
    if (!onboardingDone) AsyncStorage.setItem('onboarding_done', 'true');
    return <Redirect href="/(app)/home" />;
  }
  if (!onboardingDone) return <Redirect href="/(onboarding)/slides" />;
  return <Redirect href="/(auth)" />;
}
