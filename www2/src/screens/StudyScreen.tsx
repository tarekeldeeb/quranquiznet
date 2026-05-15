import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SURA_NAME, SURA_AYAS } from '../utils/quran';

export default function StudyScreen() {
  const [selectedSura, setSelectedSura] = useState(null);

  const loadSura = async (idx: number) => {
    setSelectedSura(idx as any);
  };

  if (selectedSura !== null) {
    return (
      <View className="flex-1 bg-white pt-12">
        <View className="flex-row items-center px-6 py-4 border-b border-gray-100">
          <TouchableOpacity onPress={() => setSelectedSura(null)}>
            <Text className="text-green-600 font-bold text-lg">عودة</Text>
          </TouchableOpacity>
          <Text className="flex-1 text-center text-xl font-bold">{SURA_NAME[selectedSura]}</Text>
        </View>
        <ScrollView className="p-6">
          <Text className="text-2xl leading-loose text-right">
             بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
          </Text>
          <Text className="text-xl text-gray-600 mt-4 text-center">
            (عرض نص السورة سيتم ربطه ببيانات SQLite لاحقاً)
          </Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 pt-16">
      <Text className="text-2xl font-bold text-gray-900 px-6 text-right mb-6">سور القرآن الكريم</Text>
      <ScrollView className="px-4">
        <View className="flex-row flex-wrap">
          {SURA_NAME.map((name, index) => (
            <TouchableOpacity 
              key={index}
              className="w-1/2 p-2"
              onPress={() => loadSura(index)}
            >
              <View className="bg-white p-4 rounded-2xl border border-gray-200 items-center">
                <Text className="text-lg font-bold text-gray-800">{name}</Text>
                <Text className="text-xs text-gray-500">{SURA_AYAS[index]} آية</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
