// Regression: sharing the "add me" code duplicated the link. Share.share()
// was given the link both embedded in `message` and again as a separate
// `url` field — share targets that surface both (e.g. iMessage) pasted it
// twice. The fix drops the redundant `url` field.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

const mockRegisterQuizCode = jest.fn();
jest.mock('../../../src/services/firebase', () => ({
  registerQuizCode: (...a: unknown[]) => mockRegisterQuizCode(...a),
  watchFriendRequests: jest.fn(() => jest.fn()),
  watchFriends: jest.fn(() => jest.fn()),
  watchPresence: jest.fn(() => jest.fn()),
  acceptFriendRequest: jest.fn(() => Promise.resolve()),
  declineFriendRequest: jest.fn(() => Promise.resolve()),
  sendPvpInvite: jest.fn(() => Promise.resolve()),
}));

import React from 'react';
import { Share } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import FriendsScreen from '../friends';
import { useProfileStore } from '../../../src/stores/profileStore';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderFriends = () => render(<SafeAreaProvider initialMetrics={metrics}><FriendsScreen /></SafeAreaProvider>);

beforeEach(() => {
  mockPush.mockClear();
  mockRegisterQuizCode.mockReset();
  mockRegisterQuizCode.mockResolvedValue('ABCD1234');
  useProfileStore.setState({
    social: { uid: 'u1', displayName: 'طارق', isAnonymous: false },
    parts: [],
    level: 1,
    loaded: true,
  });
});

describe('Friends — share my code', () => {
  it('shares a message with the link only once, not also as a separate `url`', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    const { findByText } = renderFriends();

    // The share button stays disabled until the code finishes loading —
    // wait for it before pressing, or the press is silently dropped.
    await findByText('ABCD1234');
    fireEvent.press(await findByText('مشاركة الرمز'));

    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    const arg = shareSpy.mock.calls[0][0] as { message?: string; url?: string };
    expect(arg.message).toContain('https://quranquiz.net/add/ABCD1234');
    expect(arg.url).toBeUndefined();
    shareSpy.mockRestore();
  });
});
