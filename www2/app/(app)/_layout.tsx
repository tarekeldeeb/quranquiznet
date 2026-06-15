// Bottom-tab navigator — mirrors the side-menu in www/templates/menu.html
import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { onAuthChange } from '../../src/services/firebase';
import { Ionicons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IconName; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function AppLayout() {
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthChange((user) => {
      if (!user) router.replace('/(auth)');
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#1a5276' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        tabBarActiveTintColor: '#1a5276',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: { backgroundColor: '#fff' },
        tabBarLabelStyle: { fontSize: 12 },
        headerTitleAlign: 'center',
      }}
    >
      <Tabs.Screen
        name="quiz"
        options={{
          title: 'الاختبار',
          tabBarIcon: ({ color, size }) => <TabIcon name="help-circle-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="daily"
        options={{
          title: 'يومي',
          tabBarIcon: ({ color, size }) => <TabIcon name="star-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'ملفي',
          tabBarIcon: ({ color, size }) => <TabIcon name="person-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="study"
        options={{
          title: 'حفظي',
          tabBarIcon: ({ color, size }) => <TabIcon name="book-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'الإعدادات',
          tabBarIcon: ({ color, size }) => <TabIcon name="settings-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
