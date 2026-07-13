// Integration: the redesigned login/auth screen. Verifies the why-join content,
// the icon login buttons, guest entry, and the privacy subpage link.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: jest.fn() }),
}));

const mockSignInGoogle = jest.fn((..._a: unknown[]) => Promise.resolve({ uid: 'g1' }));
const mockSignInFacebook = jest.fn((..._a: unknown[]) => Promise.resolve({ uid: 'f1' }));
const mockSignInAnon = jest.fn((..._a: unknown[]) => Promise.resolve({ uid: 'anon' }));
jest.mock('../../../src/services/firebase', () => ({
  // Wrapped so the reference resolves at call-time (after the consts init).
  signInGoogle: (...a: unknown[]) => mockSignInGoogle(...a),
  signInFacebook: (...a: unknown[]) => mockSignInFacebook(...a),
  signInAnon: (...a: unknown[]) => mockSignInAnon(...a),
  onAuthChange: () => () => {}, // no user; returns an unsubscribe
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AuthScreen from '../index';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderAuth = () => render(<SafeAreaProvider initialMetrics={metrics}><AuthScreen /></SafeAreaProvider>);

beforeEach(() => {
  mockReplace.mockClear(); mockPush.mockClear();
  mockSignInGoogle.mockClear(); mockSignInFacebook.mockClear(); mockSignInAnon.mockClear();
});

describe('Auth screen', () => {
  it('renders the title, why-join features and login options', () => {
    const { getByText } = renderAuth();
    expect(getByText('شبكة اختبار القرآن')).toBeTruthy();
    expect(getByText('تحدٍّ يومي')).toBeTruthy();       // a why-join feature tile
    expect(getByText('مزامنة سحابية')).toBeTruthy();
    // Guest play is the primary, inverted-funnel CTA; social sign-in is secondary.
    expect(getByText('العب الآن')).toBeTruthy();
    expect(getByText('المتابعة بحساب جوجل')).toBeTruthy();
    expect(getByText('المتابعة بحساب فيسبوك')).toBeTruthy();
  });

  it('signs in with Google when the Google button is pressed', () => {
    const { getByText } = renderAuth();
    fireEvent.press(getByText('المتابعة بحساب جوجل'));
    expect(mockSignInGoogle).toHaveBeenCalled();
  });

  it('signs in with Facebook when the Facebook button is pressed', () => {
    const { getByText } = renderAuth();
    fireEvent.press(getByText('المتابعة بحساب فيسبوك'));
    expect(mockSignInFacebook).toHaveBeenCalled();
  });

  it('plays as guest when the primary CTA is pressed', () => {
    const { getByText } = renderAuth();
    fireEvent.press(getByText('العب الآن'));
    expect(mockSignInAnon).toHaveBeenCalled();
  });

  it('navigates to the privacy subpage from the footer link', () => {
    const { getByText } = renderAuth();
    fireEvent.press(getByText('الشروط وسياسة الخصوصية'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/privacy');
  });
});
