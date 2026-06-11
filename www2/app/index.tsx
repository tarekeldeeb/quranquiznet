import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { onAuthChange } from '../src/services/firebase';
import type { User } from 'firebase/auth';

export default function Index() {
  const [user, setUser] = useState<User | null | 'loading'>('loading');

  useEffect(() => {
    const unsub = onAuthChange((u) => setUser(u));
    return unsub;
  }, []);

  if (user === 'loading') return null;
  if (!user) return <Redirect href="/(auth)" />;
  return <Redirect href="/(app)/quiz" />;
}
