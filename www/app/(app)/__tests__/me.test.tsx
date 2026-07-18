// Integration: the merged /me dashboard. Verifies the daily-card states
// (available / completed / unavailable) and that starting the daily quiz wires
// through to the questionnaire engine + navigation.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-constants', () => ({ expoConfig: { version: '2.0.0' } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSetOptions = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  useNavigation: () => ({ setOptions: mockSetOptions }),
}));

const mockGetDailyHead = jest.fn();
const mockSignOut = jest.fn((..._a: unknown[]) => Promise.resolve());
const mockSignInGoogle = jest.fn((..._a: unknown[]) => Promise.resolve({ uid: 'g1' }));
const mockSignInFacebook = jest.fn((..._a: unknown[]) => Promise.resolve({ uid: 'f1' }));
const mockSignInApple = jest.fn((..._a: unknown[]) => Promise.resolve({ uid: 'a1' }));
jest.mock('../../../src/services/firebase', () => ({
  getDailyHead: (...a: unknown[]) => mockGetDailyHead(...a),
  getTodayStandings: jest.fn(() => Promise.resolve([])),
  signOut: (...a: unknown[]) => mockSignOut(...a),
  signInGoogle: (...a: unknown[]) => mockSignInGoogle(...a),
  signInFacebook: (...a: unknown[]) => mockSignInFacebook(...a),
  signInApple: (...a: unknown[]) => mockSignInApple(...a),
}));

const mockInitDailyQuiz = jest.fn();
jest.mock('../../../src/services/questionnaireService', () => ({
  initDailyQuiz: (...a: unknown[]) => mockInitDailyQuiz(...a),
}));

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
import { Alert } from 'react-native';
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
  mockPush.mockClear(); mockReplace.mockClear(); mockSetOptions.mockClear();
  mockInitDailyQuiz.mockClear(); mockGetDailyHead.mockReset();
  mockSignOut.mockReset(); mockSignOut.mockResolvedValue(undefined);
  mockSignInGoogle.mockReset(); mockSignInGoogle.mockResolvedValue({ uid: 'g1' });
  mockSignInFacebook.mockReset(); mockSignInFacebook.mockResolvedValue({ uid: 'f1' });
  mockSignInApple.mockReset(); mockSignInApple.mockResolvedValue({ uid: 'a1' });
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
  it('greets the user in the header and shows their points on the page', async () => {
    mockGetDailyHead.mockResolvedValue(null);
    const { queryAllByText } = renderMe();
    // The greeting now lives in the navigation header (see me.tsx's
    // navigation.setOptions effect), not inline on the page.
    await waitFor(() => expect(mockSetOptions).toHaveBeenCalled());
    const lastOptions = mockSetOptions.mock.calls[mockSetOptions.mock.calls.length - 1][0];
    const header = render(lastOptions.headerTitle());
    expect(header.getByText(/مرحباً/)).toBeTruthy();
    expect(queryAllByText(/نقطة/).length).toBeGreaterThan(0);
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
    expect(await findByText(/أكملت اختبار اليوم/)).toBeTruthy();
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

describe('Me dashboard — guest upgrade [bug #3]', () => {
  beforeEach(() => {
    // Render as an anonymous guest so the in-page upgrade card is shown.
    useProfileStore.setState({ social: { uid: 'anon', displayName: 'زائر(ة)', isAnonymous: true } });
  });

  it('shows the Google/Facebook upgrade buttons for a guest', async () => {
    mockGetDailyHead.mockResolvedValue(null);
    const { findByLabelText } = renderMe();
    expect(await findByLabelText('المتابعة بحساب جوجل')).toBeTruthy();
    expect(await findByLabelText('المتابعة بحساب فيسبوك')).toBeTruthy();
  });

  it('shows the Apple upgrade button for a guest (iOS) and signs in on press', async () => {
    mockGetDailyHead.mockResolvedValue(null);
    const { findByTestId } = renderMe();
    fireEvent(await findByTestId('apple-upgrade-button'), 'buttonPress');
    await waitFor(() => expect(mockSignInApple).toHaveBeenCalled());
  });

  it('surfaces an error (does not fail silently) when the upgrade is refused', async () => {
    mockGetDailyHead.mockResolvedValue(null);
    mockSignInGoogle.mockRejectedValueOnce(new Error('refused'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { findByLabelText } = renderMe();
    fireEvent.press(await findByLabelText('المتابعة بحساب جوجل'));

    await waitFor(() => expect(mockSignInGoogle).toHaveBeenCalled());
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('خطأ', expect.any(String)));
    alertSpy.mockRestore();
  });
});
