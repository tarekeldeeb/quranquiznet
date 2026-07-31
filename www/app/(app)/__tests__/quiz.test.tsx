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
    useNavigation: () => ({ setOptions: jest.fn() }),
    // Run the focus callback once on mount, like a real screen gaining focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useFocusEffect: (cb: () => void) => { React.useEffect(() => cb(), []); },
  };
});

const mockCreateNextDailyQ = jest.fn((..._a: unknown[]) => Promise.resolve(true));
// A plain data property copied onto the module's mock object would get
// snapshotted by each file's own `import *` interop wrapper — mutating it from
// the test wouldn't be visible to quiz.tsx's separately-wrapped copy. A getter
// backed by this closure variable stays live across both.
let mockPendingDailyStart = false;
jest.mock('../../../src/services/questionnaireService', () => {
  const { makeEmptyQO } = require('../../../src/models/questionnaire');
  return {
    qo: makeEmptyQO(),
    get pendingDailyStart() { return mockPendingDailyStart; },
    clearPendingDailyStart: jest.fn(),
    initQuestionnaire: jest.fn(),
    initDailyQuiz: jest.fn(),
    createNextQ: jest.fn(() => Promise.resolve()),
    createNextDailyQ: (...a: unknown[]) => mockCreateNextDailyQ(...a),
    getUpScore: jest.fn(() => 10),
  };
});

jest.mock('../../../src/services/firebase', () => ({
  getDailyHead: jest.fn(() => Promise.resolve(null)),
  submitDailyResultWithRetry: jest.fn(() => Promise.resolve(true)),
  getTodayStandings: jest.fn(() => Promise.resolve([])),
  flushPendingDailySubmit: jest.fn(() => Promise.resolve()),
  reportQuestion: jest.fn(() => Promise.resolve()),
  pushCurrentProfile: jest.fn(() => Promise.resolve()),
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
import { Share } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
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
  mockCreateNextDailyQ.mockReset(); mockCreateNextDailyQ.mockResolvedValue(true);
  mockPendingDailyStart = false;
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

  it('shows the combined weak review button when at least 2 weak parts exist', async () => {
    const { findByText } = renderQuiz();
    expect(await findByText('مراجعة جميع مواضع الضعف')).toBeTruthy();
  });

  it('hides the combined weak review button when only 1 checked part exists', async () => {
    useProfileStore.setState({
      parts: [
        part('الفاتحة', false, 5, 5), // unchecked
        part('البقرة', true, 1, 10),  // only 1 checked part
      ],
    });
    const { findByText, queryByText } = renderQuiz();
    expect(await findByText('البقرة')).toBeTruthy();
    expect(queryByText('مراجعة جميع مواضع الضعف')).toBeNull();
  });

  it('does not navigate away on entry', async () => {
    renderQuiz();
    await waitFor(() => {}, { timeout: 50 }).catch(() => {});
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

// Regression: sharing the daily-quiz result duplicated the link. Share.share()
// was given the link both embedded in `message` and again as a separate `url`
// field — share targets that surface both (e.g. iMessage) pasted it twice.
// The fix drops the redundant `url` field.
describe('Quiz — daily end share', () => {
  it('shares the daily score with the link only once, not also as a separate `url`', async () => {
    // A daily session that ends on its very first question (no more questions
    // to draw) is enough to reach the daily-end modal without answering any.
    mockCreateNextDailyQ.mockResolvedValueOnce(false);
    mockPendingDailyStart = true;

    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    const { findByText } = renderQuiz();

    fireEvent.press(await findByText('شارك النتيجة'));

    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    const arg = shareSpy.mock.calls[0][0] as { message?: string; url?: string };
    expect(arg.message).toContain('https://quranquiz.net');
    expect(arg.url).toBeUndefined();
    shareSpy.mockRestore();
  });
});
