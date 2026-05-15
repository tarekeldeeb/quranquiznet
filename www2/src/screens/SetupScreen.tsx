import React, { useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { initDatabase } from '../database/init';
import qData from '../../www/q.json';

export default function SetupScreen({ onComplete }: { onComplete: () => void }) {
  const [status, setStatus] = useState('initializing');
  const [progress, setProgress] = useState(0);

  const performImport = async () => {
    setStatus('importing');
    try {
      const db = await initDatabase();
      const rows = (qData as any).objects[0].rows;
      const total = rows.length;

      const chunkSize = 500;
      for (let i = 0; i < total; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        
        await (db as any).withTransactionAsync(async () => {
          for (const row of chunk) {
            await (db as any).runAsync(
              'INSERT INTO q (id, txt, txtsym, sim1, sim2, sim3, sim1not2p1, aya) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [row[0], row[1], row[2], row[3], row[4], row[5], row[6] ? JSON.stringify(row[6]) : null, row[7]]
            );
          }
        });
        
        setProgress(Math.round(((i + chunk.length) / total) * 100));
      }

      setStatus('complete');
      setTimeout(onComplete, 1000);
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-white p-10">
      <Text className="text-2xl font-bold text-gray-900 text-center mb-4">
        إعداد قاعدة البيانات
      </Text>
      
      {status === 'initializing' && (
        <TouchableOpacity 
          className="bg-green-500 px-10 py-4 rounded-full"
          onPress={performImport}
        >
          <Text className="text-white font-bold text-lg">تحميل البيانات</Text>
        </TouchableOpacity>
      )}

      {(status === 'importing' || status === 'complete') && (
        <View className="items-center w-full">
          <ActivityIndicator size="large" color="#10b981" />
          <Text className="mt-4 text-lg text-gray-600 font-bold">{progress}%</Text>
          <Text className="mt-2 text-gray-500">جاري معالجة كلمات القرآن الكريم...</Text>
        </View>
      )}

      {status === 'error' && (
        <Text className="text-red-500 text-center">عذراً، حدث خطأ أثناء تحميل البيانات.</Text>
      )}
    </View>
  );
}
