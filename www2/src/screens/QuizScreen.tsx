import React, { useEffect, useState } from 'react';
import { View, Text, Button, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { generateSimpleQuestions } from '../models/questionnaire';
import { seedDatabaseIfNeeded } from '../db/initDb';
import questionnaireService from '../services/questionnaireService';

type QuizQuestion = {
  id: number;
  startIdx: number;
  text: string;
  choices: string[];
  answerIndex: number;
};

export default function QuizScreen() {
  const [qs, setQs] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        await seedDatabaseIfNeeded();
        const g = await questionnaireService.createNQuestionsFromProfile(5);
        if (mounted) setQs(g);
      } catch (e) {
        setQs(generateSimpleQuestions(5) as QuizQuestion[]);
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false };
  }, []);

  const handleAnswer = (questionId: number, selectedIndex: number, answerIndex: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: selectedIndex }));
    if (selectedIndex === answerIndex) {
      alert('Correct');
    } else {
      alert('Wrong');
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quiz</Text>
      <FlatList
        data={qs}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => {
          const selected = answers[item.id];
          return (
            <View style={styles.card}>
              <Text style={styles.qText}>{item.text}</Text>
              {item.choices.map((c, i) => (
                <Button
                  key={i}
                  title={c}
                  disabled={selected !== undefined}
                  onPress={() => handleAnswer(item.id, i, item.answerIndex)}
                />
              ))}
              {selected !== undefined && (
                <Text style={styles.resultText}>
                  {selected === item.answerIndex ? '✅ Correct' : '❌ Wrong'}
                </Text>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  card: { marginBottom: 12, padding: 8, borderWidth: 1, borderColor: '#ddd' },
  qText: { marginBottom: 6 },
  resultText: { marginTop: 8, fontWeight: '700' },
});
