// Bottom-tab navigator — mirrors the side-menu in www/templates/menu.html
import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Image, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  onAuthChange, fetchRemoteProfile, pushProfile,
} from '../../src/services/firebase';
import { useProfileStore } from '../../src/stores/profileStore';
import { Ionicons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const appIcon = require('../../assets/images/app-icon.png');

function TabIcon({ name, color, size }: { name: IconName; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function HeaderLogo() {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={s.headerLogo}
      onPress={() => router.navigate('/(app)/me')}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="الصفحة الرئيسية"
    >
      <Image source={appIcon} style={s.headerIcon} />
      <Text style={s.headerTitle}>شبكة اختبار القرآن</Text>
    </TouchableOpacity>
  );
}

async function detectCountry(setCountry: (c: string) => void) {
  try {
    const res = await fetch(`https://ipinfo.io?token=${process.env.EXPO_PUBLIC_IPINFO_TOKEN ?? ''}`);
    const data = await res.json() as { country?: string };
    if (data.country) setCountry(data.country.toLowerCase());
  } catch { /* non-critical, silently ignore */ }
}

export default function AppLayout() {
  const router = useRouter();
  const profile = useProfileStore();

  useEffect(() => {
    detectCountry(profile.setCountry);
    const unsub = onAuthChange(async (user) => {
      if (!user) {
        router.replace('/(auth)');
        return;
      }

      // Sync auth identity + remote profile immediately, regardless of active tab
      if (!user.isAnonymous) {
        await profile.setSocial({
          uid: user.uid,
          displayName: user.displayName ?? undefined,
          photoURL: user.photoURL ?? undefined,
          email: user.email ?? undefined,
          isAnonymous: false,
        });
        const remote = await fetchRemoteProfile(user.uid);
        if (remote) {
          await profile.syncTo(remote as Parameters<typeof profile.syncTo>[0]);
        }
        // Push local profile up (after sync so we write the merged result)
        const s = useProfileStore.getState();
        await pushProfile(user.uid, {
          uid: s.uid,
          lastSeed: s.lastSeed,
          lastUpdate: s.lastUpdate,
          lastSync: Date.now(),
          level: s.level,
          specialEnabled: s.specialEnabled,
          scores: s.scores,
          parts: s.parts,
        });
      } else {
        profile.setSocial({ uid: user.uid, displayName: 'زائر(ة)', isAnonymous: true });
      }
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0d2d4e' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        headerTitle: () => <HeaderLogo />,
        tabBarActiveTintColor: '#0d2d4e',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: { backgroundColor: '#fff' },
        tabBarShowLabel: false,
        headerTitleAlign: 'center',
      }}
    >
      {/* Declared right-to-left for RTL: the tab bar renders in declaration
          order (LTR), so listing league → quiz → me puts ملفي (Me / home)
          on the right as the landing tab. */}
      <Tabs.Screen
        name="league"
        options={{
          tabBarIcon: ({ color, size }) => <TabIcon name="trophy-outline" color={color} size={size} />,
          tabBarLabel: 'البطولة',
        }}
      />
      <Tabs.Screen
        name="quiz"
        options={{
          tabBarIcon: ({ color, size }) => <TabIcon name="play-circle-outline" color={color} size={size} />,
          tabBarLabel: 'العب',
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          tabBarIcon: ({ color, size }) => <TabIcon name="home" color={color} size={size} />,
          tabBarLabel: 'الرئيسية',
        }}
      />
      {/* Legacy screens — hidden from tab bar */}
      <Tabs.Screen name="home"     options={{ href: null }} />
      <Tabs.Screen name="daily"    options={{ href: null }} />
      <Tabs.Screen name="profile"  options={{ href: null }} />
      <Tabs.Screen name="study"    options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

const s = StyleSheet.create({
  headerLogo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    width: 30,
    height: 30,
    borderRadius: 6,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
