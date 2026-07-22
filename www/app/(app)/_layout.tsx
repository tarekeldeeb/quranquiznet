// Bottom-tab navigator — mirrors the side-menu in www/templates/menu.html
import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Image, Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import {
  onAuthChange, fetchRemoteProfile, pushProfile,
} from '../../src/services/firebase';
import { useProfileStore } from '../../src/stores/profileStore';
import { DEFAULT_GUEST_NAME } from '../../src/models/constants';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/tokens';
import PressScale from '../../src/components/PressScale';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const appIcon = require('../../assets/images/app-icon.png');

function TabIcon({ name, color, size }: { name: IconName; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

// Compact brand mark — the default header for routes that don't set their own
// contextual title (hidden legacy screens). The three main tabs each replace
// this with something situational instead of repeating the app's name.
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

// Raised gold "ابدأ" button — the one place in the app the gold accent is
// spent at full strength. Sits centered and elevated above the bar instead of
// sitting flush with its siblings, so Start reads as the game's architecture
// rather than a third menu item.
function PlayTabButton({
  onPress, accessibilityState, colors,
}: { onPress?: () => void; accessibilityState?: { selected?: boolean }; colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <PressScale
      onPress={onPress}
      style={s.playSlot}
      scaleTo={0.93}
      accessibilityRole="button"
      accessibilityLabel="ابدأ"
      accessibilityState={accessibilityState}
    >
      <View style={[s.playCircle, { backgroundColor: colors.gold, borderColor: colors.card, shadowColor: colors.goldDeep }]}>
        <Ionicons name="play" size={24} color={colors.navy} style={{ marginRight: -2 }} />
      </View>
      <Text style={[s.playLabel, { color: colors.gold }]}>ابدأ</Text>
    </PressScale>
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
  const { colors } = useTheme();

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
        // Preserve a guest's own custom nickname across re-auth events (e.g. app
        // restart) instead of stomping it back to the default every time — only
        // reset to the default if this is a different anonymous uid (fresh guest).
        const current = useProfileStore.getState().social;
        const displayName = current.uid === user.uid && current.displayName
          ? current.displayName
          : DEFAULT_GUEST_NAME;
        profile.setSocial({ uid: user.uid, displayName, isAnonymous: true });
      }
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        headerTitle: () => <HeaderLogo />,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.inkSoft,
        // height/labelStyle tuned generously: the custom Arabic font's line
        // metrics run taller than a system font at the same size, and the
        // previous 60/11px combo was clipping the bottom of "الرئيسية" and
        // "البطولة" against the bar's fixed height.
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line, height: 66, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', lineHeight: 14 },
        tabBarShowLabel: true,
        headerTitleAlign: 'center',
      }}
    >
      {/* Declared right-to-left for RTL: the tab bar renders in declaration
          order (LTR), so listing league → play → me puts ملفي (Me / home)
          on the right as the landing tab, البطولة on the left, and ابدأ
          raised in the center. */}
      <Tabs.Screen
        name="league"
        options={{
          tabBarIcon: ({ color, size, focused }) => <TabIcon name={focused ? 'trophy' : 'trophy-outline'} color={color} size={size} />,
          tabBarLabel: 'البطولة',
        }}
      />
      <Tabs.Screen
        name="quiz"
        options={{
          tabBarLabel: 'ابدأ',
          tabBarButton: (props) => (
            <PlayTabButton
              onPress={props.onPress as (() => void) | undefined}
              accessibilityState={props.accessibilityState as { selected?: boolean } | undefined}
              colors={colors}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          tabBarIcon: ({ color, size, focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} color={color} size={size} />,
          tabBarLabel: 'الرئيسية',
        }}
      />
      {/* PvP match + the progression map — reached from the Me screen, not the tab bar */}
      <Tabs.Screen name="pvp"      options={{ href: null }} />
      {/* map.tsx renders its own in-page header (title + active-count badge) */}
      <Tabs.Screen name="map"      options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="home"     options={{ href: null }} />
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
    fontFamily: 'PlexArabic-Bold',
    letterSpacing: 0.3,
  },
  playSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  playCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    borderWidth: 3,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  playLabel: {
    fontSize: 11,
    fontFamily: 'PlexArabic-Bold',
    marginTop: 2,
  },
});
