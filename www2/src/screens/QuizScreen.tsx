import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { createNormalQ } from '../services/questionnaire';

export default function QuizScreen() {
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const startQuiz = async () => {
    setLoading(true);
    setFinished(false);
    setScore(0);
    setCurrentRound(0);
    try {
      const newQuiz = await createNormalQ(-1);
      setQuiz(newQuiz as any);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleAnswer = (index: number) => {
    if (quiz && (quiz as any).rounds[currentRound].correctIndex === index) {
      setScore(s => s + 10);
    }

    if (currentRound < 9) {
      setCurrentRound(r => r + 1);
    } else {
      setFinished(true);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#10b981" />
        <Text className="mt-4 text-gray-600">جاري تحضير المسابقة...</Text>
      </View>
    );
  }

  if (finished) {
    return (
      <View className="flex-1 items-center justify-center bg-white p-6">
        <Text className="text-3xl font-bold text-gray-900">انتهت المسابقة!</Text>
        <Text className="text-xl text-gray-600 mt-2">نتيجتك: {score}</Text>
        <TouchableOpacity 
          className="mt-8 bg-green-500 px-8 py-3 rounded-full"
          onPress={startQuiz}
        >
          <Text className="text-white font-bold text-lg">إعادة المحاولة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!quiz) {
    return (
      <View className="flex-1 items-center justify-center bg-white p-6">
        <Text className="text-2xl font-bold text-gray-900 text-center">هل أنت مستعد لاختبار حفظك؟</Text>
        <TouchableOpacity 
          className="mt-8 bg-green-500 px-8 py-3 rounded-full"
          onPress={startQuiz}
        >
          <Text className="text-white font-bold text-lg">ابدأ الآن</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const round = (quiz as any).rounds[currentRound];

  return (
    <View className="flex-1 bg-gray-50 pt-16 px-6">
      <View className="flex-row justify-between items-center mb-8">
        <Text className="text-lg font-bold text-gray-500">جولة {currentRound + 1} / 10</Text>
        <Text className="text-lg font-bold text-green-600">النقاط: {score}</Text>
      </View>

      <View className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 mb-8">
        <Text className="text-2xl font-bold text-gray-800 text-center leading-loose">
          {round.question} ...
        </Text>
      </View>

      <View className="space-y-3">
        {round.options.map((option: string, index: number) => (
          <TouchableOpacity 
            key={index}
            className="bg-white p-4 rounded-2xl border border-gray-200 active:bg-gray-50"
            onPress={() => handleAnswer(index)}
          >
            <Text className="text-xl text-gray-800 text-center font-medium">{option}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
