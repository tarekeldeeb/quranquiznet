import React from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { useProfileStore } from '../store/useProfileStore';

export default function ProfileScreen() {
  const { settings, setSetting, parts } = useProfileStore((state: any) => state);
  
  const completedParts = parts.filter((p: number) => p > 0).length;

  return (
    <ScrollView className="flex-1 bg-gray-50 pt-16">
      <View className="px-6 mb-8">
        <Text className="text-3xl font-bold text-gray-900 text-right">حسابي</Text>
      </View>

      <View className="px-6 mb-8">
        <View className="bg-white p-6 rounded-3xl shadow-sm flex-row justify-between items-center">
          <View className="items-center">
            <Text className="text-2xl font-bold text-green-600">{completedParts}</Text>
            <Text className="text-gray-500 text-xs">أجزاء تمت</Text>
          </View>
          <View className="items-center">
            <Text className="text-2xl font-bold text-blue-600">0</Text>
            <Text className="text-gray-500 text-xs">نقاط اليوم</Text>
          </View>
          <View className="items-center">
            <Text className="text-2xl font-bold text-orange-600">0</Text>
            <Text className="text-gray-500 text-xs">ترتيبك</Text>
          </View>
        </View>
      </View>

      <View className="px-6">
        <Text className="text-xl font-bold text-gray-800 text-right mb-4">الإعدادات</Text>
        
        <View className="bg-white rounded-3xl overflow-hidden">
          <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
            <Switch 
              value={settings.showAyaMarks}
              onValueChange={(val: boolean) => setSetting('showAyaMarks', val)}
            />
            <Text className="text-lg text-gray-700">إظهار أرقام الآيات</Text>
          </View>

          <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
            <Switch 
              value={settings.vibrate}
              onValueChange={(val: boolean) => setSetting('vibrate', val)}
            />
            <Text className="text-lg text-gray-700">الاهتزاز عند الإجابة</Text>
          </View>
          
          <TouchableOpacity className="p-4 items-center">
            <Text className="text-blue-600 font-bold text-lg">تسجيل الدخول (Firebase)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
