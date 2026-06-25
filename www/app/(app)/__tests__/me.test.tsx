// Integration: the merged /me dashboard. Verifies the daily-card states
// (available / completed / unavailable) and that starting the daily quiz wires
// through to the questionnaire engine + navigation.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-constants', () => ({ expoConfig: { version: '2.0.0' } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
}));

const mockGetDailyHead = jest.fn();
jest.mock('../../../src/services/firebase', () => ({
  getDailyHead: (...a: unknown[]) => mockGetDailyHead(...a),
  signOut: jest.fn(() => Promise.resolve()),
  signInGoogle: jest.fn(),
  signInFacebook: jest.fn(),
}));

const mockInitDailyQuiz = jest.fn();
jest.mock('../../../src/services/questionnaireService', () => ({
  initDailyQuiz: (...a: unknown[]) => mockInitDailyQuiz(...a),
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MeScreen from '../me';
import { useProfileStore, StudyPart } from '../../../src/stores/profileStore';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderMe = () => render(<SafeAreaProvider initialMetrics={metrics}><MeScreen /></SafeAreaProvider>);

function part(name: string, checked = true): StudyPart {
  return { start: 1, length: 10, numCorrect: [0, 2, 0, 0], numQuestions: [0, 2, 0, 0], name, checked };
}

const today = () => new Date().toISOString().split('T')[0];
const head = () => ({ daily_random: 42, start_time: Date.now(), submit_to_ref: 'head_submit', yesterday: '' });

beforeEach(() => {
  mockPush.mockClear(); mockReplace.mockClear(); mockInitDailyQuiz.mockClear(); mockGetDailyHead.mockReset();
  // Full 50-part profile (45 suras + 5 juz), as in production — the daily-weights
  // computation indexes every part.
  const parts = Array.from({ length: 50 }, (_, i) => part(`جزء/سورة ${i}`, i < 3));
  useProfileStore.setState({
    parts,
    scores: [{ date: Date.now(), score: 0 }],
    social: { uid: 'u1', displayName: 'طارق الديب', isAnonymous: false },
    streak: 3,
    level: 1,
    lastDailyCompletedDate: '',
    loaded: true,
  });
});

describe('Me dashboard — daily card states', () => {
  it('greets the user and shows their points', async () => {
    mockGetDailyHead.mockResolvedValue(null);
    const { getByText, queryAllByText } = renderMe();
    expect(getByText(/مرحباً/)).toBeTruthy();
    expect(queryAllByText(/نقاطك/).length).toBeGreaterThan(0);
  });

  it('shows the start button when a daily quiz is available and not completed', async () => {
    mockGetDailyHead.mockResolvedValue(head());
    const { findByText } = renderMe();
    expect(await findByText('ابدأ اختبار اليوم')).toBeTruthy();
  });

  it('shows the completed card when today’s daily is already done', async () => {
    useProfileStore.setState({ lastDailyCompletedDate: today() });
    mockGetDailyHead.mockResolvedValue(head());
    const { findByText } = renderMe();
    expect(await findByText('أحسنت! أكملت اختبار اليوم')).toBeTruthy();
  });

  it('shows the unavailable card when no daily is published', async () => {
    mockGetDailyHead.mockResolvedValue(null);
    const { findByText } = renderMe();
    expect(await findByText('لا يوجد اختبار اليوم حتى الآن')).toBeTruthy();
  });

  it('starting the daily quiz inits the engine and navigates to /quiz', async () => {
    mockGetDailyHead.mockResolvedValue(head());
    const { findByText } = renderMe();
    fireEvent.press(await findByText('ابدأ اختبار اليوم'));
    await waitFor(() => expect(mockInitDailyQuiz).toHaveBeenCalled());
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/(app)/quiz' }));
  });
});
