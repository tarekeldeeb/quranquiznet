import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import ProgressGrid from '../components/ProgressGrid';

export default function HomeScreen() {
  return (
    <ScrollView className="flex-1 bg-white pt-12">
      <View className="p-6">
        <Text className="text-3xl font-bold text-gray-900 text-right">أهلاً بك</Text>
        <Text className="text-lg text-gray-600 mt-2 text-right">اختبر حفظك للقرآن الكريم</Text>
      </View>
      
      <View className="mt-4">
        <Text className="text-xl font-bold text-gray-800 px-6 text-right">تقدمك</Text>
        <ProgressGrid />
      </View>
    </ScrollView>
  );
}
