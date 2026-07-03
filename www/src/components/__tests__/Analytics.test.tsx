// Regression: the <Analytics> component must not crash on native. On React
// Native `window` is defined but `window.location` is undefined, so a naive
// `typeof window !== 'undefined' ? window.location.search` guard throws
// "Cannot read property 'search' of undefined" — which (in a useEffect with no
// error boundary) became a fatal RCTFatalException that killed the app right
// after the data-load splash. jest-expo runs with Platform.OS === 'ios', so
// this test exercises the native path.

const mockTrackPageView = jest.fn();
jest.mock('../../services/analytics', () => ({
  trackPageView: (...a: unknown[]) => mockTrackPageView(...a),
}));

jest.mock('expo-router', () => ({
  usePathname: () => '/me',
  useGlobalSearchParams: () => ({ dailyMode: '1' }),
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import { Analytics } from '../Analytics';

describe('Analytics — native safety [regression]', () => {
  let originalWindow: unknown;

  beforeEach(() => {
    mockTrackPageView.mockClear();
    // Reproduce the device condition: `window` exists but has no `location`.
    originalWindow = (global as { window?: unknown }).window;
    (global as { window?: unknown }).window = {};
  });

  afterEach(() => {
    (global as { window?: unknown }).window = originalWindow;
  });

  it('renders on native without throwing and tracks the path only (no search)', () => {
    expect(() => render(<Analytics />)).not.toThrow();
    expect(mockTrackPageView).toHaveBeenCalledWith('/me');
  });
});
