import React from 'react';
import { View, Text } from 'react-native';
import { useProfileStore } from '../store/useProfileStore';

export default function ProgressGrid() {
  const parts = useProfileStore((state: any) => state.parts);

  return (
    <View className="flex-row flex-wrap justify-between p-4">
      {parts.map((score: number, index: number) => (
        <View 
          key={index} 
          className={score > 0 ? "w-12 h-12 mb-2 rounded-lg items-center justify-center bg-green-500" : "w-12 h-12 mb-2 rounded-lg items-center justify-center bg-gray-200"}
        >
          <Text className={score > 0 ? "text-xs font-bold text-white" : "text-xs font-bold text-gray-500"}>
            {index + 1}
          </Text>
        </View>
      ))}
    </View>
  );
}
