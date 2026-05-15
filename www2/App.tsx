import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as SQLite from 'expo-sqlite';
import HomeScreen from './src/screens/HomeScreen';
import QuizScreen from './src/screens/QuizScreen';
import StudyScreen from './src/screens/StudyScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SetupScreen from './src/screens/SetupScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSetup();
  }, []);

  const checkSetup = async () => {
    try {
      const db = await SQLite.openDatabaseAsync('quran.db');
      const result: any = await db.getFirstAsync('SELECT COUNT(*) as count FROM q');
      if (result && result.count > 70000) {
        setIsSetupComplete(true);
      }
    } catch (e) {
      console.log('Setup check failed, likely first run');
    }
    setLoading(false);
  };

  if (loading) return null;

  if (!isSetupComplete) {
    return <SetupScreen onComplete={() => setIsSetupComplete(true)} />;
  }

  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{ headerShown: false }}>
        <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'الرئيسية' }} />
        <Tab.Screen name="Quiz" component={QuizScreen} options={{ title: 'المسابقة' }} />
        <Tab.Screen name="Study" component={StudyScreen} options={{ title: 'المراجعة' }} />
        <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'حسابي' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
