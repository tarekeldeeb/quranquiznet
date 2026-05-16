import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator } from 'react-native';
import { seedDatabaseIfNeeded } from '../db/initDb';
import { useProfileStore } from '../stores/profileStore';
import { useNavigation } from '@react-navigation/native';

export default function HomeScreen() {
  const [loading, setLoading] = useState(false);
  const name = useProfileStore(state => state.name);
  const parts = useProfileStore(state => state.parts);
  const makeDefaultProfile = useProfileStore(state => state.makeDefaultProfile);
  const navigation = useNavigation();

  useEffect(() => {
    if (!parts || parts.length === 0) {
      makeDefaultProfile();
    }
  }, [parts, makeDefaultProfile]);

  async function handleSeed() {
    setLoading(true);
    try {
      await seedDatabaseIfNeeded();
      alert('Database seeded (partial).');
    } catch (e) {
      console.error(e);
      alert('Failed to seed DB: ' + e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn() {
    setLoading(true);
    try {
      const fb = await import('../services/firebase');
      if (!fb.isFirebaseConfigured) {
        alert('Firebase is not configured. Please set the config and restart the app.');
        return;
      }

      const res = await fb.signInAnon();
      alert('Signed in anonymously');
      const user = res.user;

      const remote = await fb.readProfile(user.uid).catch(() => null);
      if (remote) {
        const store = useProfileStore.getState();
        store.applyCloudProfile(remote);
        alert('Profile loaded from cloud.');
      } else {
        alert('No cloud profile found for this user. Local profile retained.');
      }
    } catch (e) {
      console.error('Sign in failed', e);
      alert('Sign in failed: ' + e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSyncToCloud() {
    setLoading(true);
    try {
      const fb = await import('../services/firebase');
      const currentUser = fb.auth?.currentUser;
      if (!currentUser) {
        alert('Not signed in');
        return;
      }
      const profile = useProfileStore.getState();
      await fb.writeProfile(currentUser.uid, profile.toCloudProfile());
      alert('Profile synced to cloud');
    } catch (e) {
      console.error('Sync failed', e);
      alert('Sync failed: ' + e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quran Quiz — Home (www2)</Text>
      <Text style={styles.subtitle}>Targets: iOS, Android, Web</Text>
      <Text style={styles.info}>Profile: {name ?? 'anonymous'}</Text>
      <View style={{ height: 12 }} />
      <Button title="Seed DB (partial)" onPress={handleSeed} disabled={loading} />
      <View style={{ height: 12 }} />
      <Button title="Quiz" onPress={() => navigation.navigate('Quiz' as never)} />
      <View style={{ height: 8 }} />
      <Button title="Sign In (anon)" onPress={handleSignIn} />
      <View style={{ height: 8 }} />
      <Button title="Sync Profile to Cloud" onPress={handleSyncToCloud} />
      <View style={{ height: 8 }} />
      <Button title="Study" onPress={() => navigation.navigate('Study' as never)} />
      <View style={{ height: 8 }} />
      <Button title="Profile" onPress={() => navigation.navigate('Profile' as never)} />
      <View style={{ height: 8 }} />
      <Button title="Daily" onPress={() => navigation.navigate('Daily' as never)} />
      <View style={{ height: 8 }} />
      <Button title="Settings" onPress={() => navigation.navigate('Settings' as never)} />
      {loading && <ActivityIndicator style={{ marginTop: 12 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', marginTop: 20 },
  subtitle: { fontSize: 14, color: '#555', marginTop: 6 },
  info: { marginTop: 12 },
});
