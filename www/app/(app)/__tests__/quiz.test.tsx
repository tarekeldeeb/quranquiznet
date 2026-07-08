// Integration: the /quiz screen entry transitions. With no live session the
// focus logic must land on the chooser (random vs a weak sura). The deeper
// answer/flip/summary cadence is covered by the pure tests in quizFlow.test.ts.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
    useLocalSearchParams: () => ({}),
    // Run the focus callback once on mount, like a real screen gaining focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useFocusEffect: (cb: () => void) => { React.useEffect(() => cb(), []); },
  };
});

jest.mock('../../../src/services/questionnaireService', () => {
  const { makeEmptyQO } = require('../../../src/models/questionnaire');
  return {
    qo: makeEmptyQO(),
    pendingDailyStart: false,
    clearPendingDailyStart: jest.fn(),
    initQuestionnaire: jest.fn(),
    initDailyQuiz: jest.fn(),
    createNextQ: jest.fn(() => Promise.resolve()),
    createNextDailyQ: jest.fn(() => Promise.resolve(true)),
    getUpScore: jest.fn(() => 10),
  };
});

jest.mock('../../../src/services/firebase', () => ({
  getDailyHead: jest.fn(() => Promise.resolve(null)),
  submitDailyResult: jest.fn(() => Promise.resolve()),
  reportQuestion: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../../src/db/idb', () => ({ ayaNumberOf: jest.fn(() => Promise.resolve(1)) }));

// expo-notifications reaches into native modules that aren't set up under jest —
// stub the whole service so it's never actually required.
jest.mock('../../../src/services/notifications', () => ({
  configureNotifications: jest.fn(),
  requestPermission: jest.fn(() => Promise.resolve(false)),
  hasPermission: jest.fn(() => Promise.resolve(false)),
  scheduleStreakReminder: jest.fn(() => Promise.resolve()),
  scheduleDailyReminder: jest.fn(() => Promise.resolve()),
}));

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import QuizScreen from '../quiz';
import { useProfileStore, StudyPart } from '../../../src/stores/profileStore';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderQuiz = () => render(<SafeAreaProvider initialMetrics={metrics}><QuizScreen /></SafeAreaProvider>);

function part(name: string, checked: boolean, correct = 1, questions = 5): StudyPart {
  return { start: 1, length: 10, numCorrect: [0, correct, 0, 0], numQuestions: [0, questions, 0, 0], name, checked };
}

beforeEach(() => {
  mockPush.mockClear(); mockReplace.mockClear();
  useProfileStore.setState({
    parts: [
      part('الفاتحة', true, 5, 5),
      part('البقرة', true, 1, 10),   // weak, checked ⇒ appears in chooser
      part('آل عمران', true, 2, 10), // weak, checked
    ],
    level: 1,
    loaded: true,
  });
});

describe('Quiz entry — chooser', () => {
  it('offers the chooser when there is no live session', async () => {
    const { findByText } = renderQuiz();
    expect(await findByText('ابدأ اختباراً')).toBeTruthy();
  });

  it('lists the random option and a weak sura to review', async () => {
    const { findByText } = renderQuiz();
    expect(await findByText(/اختبار عشوائي/)).toBeTruthy();
    // weak, checked sura surfaced for review
    expect(await findByText('البقرة')).toBeTruthy();
  });

  it('does not navigate away on entry', async () => {
    renderQuiz();
    await waitFor(() => {}, { timeout: 50 }).catch(() => {});
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
