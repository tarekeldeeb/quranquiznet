// Tap-on-push routing (observeNotificationTaps / routeForNotification).
//
// expo-notifications reaches into native modules that aren't set up under
// jest, so its API surface is mocked; jest-expo runs with Platform.OS='ios',
// which makes the service's isNative guard pass. NOTE: handledTapId in the
// service is module-level state shared by every test in this file — each test
// uses distinct notification identifiers so the dedupe guard never carries
// over between tests.

const mockGetLastResponse = jest.fn<Promise<unknown>, []>();
const mockAddListener = jest.fn();

jest.mock('expo-notifications', () => ({
  getLastNotificationResponseAsync: () => mockGetLastResponse(),
  addNotificationResponseReceivedListener: (cb: unknown) => mockAddListener(cb),
  // Surface touched by the rest of the service if anything else runs.
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

// Keep the service's heavyweight imports out of the test environment.
jest.mock('../firebase', () => ({ savePushToken: jest.fn() }));
jest.mock('../../i18n', () => ({ __esModule: true, default: { t: (k: string) => k } }));

import { observeNotificationTaps, routeForNotification } from '../notifications';

type TapResponse = {
  notification: { request: { identifier: string; content: { data: unknown } } };
};

function tap(identifier: string, data: unknown): TapResponse {
  return { notification: { request: { identifier, content: { data } } } };
}

// One microtask hop is not enough: handle() runs inside the promise's .then.
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

let removeSub: jest.Mock;

beforeEach(() => {
  mockGetLastResponse.mockReset().mockResolvedValue(null);
  removeSub = jest.fn();
  mockAddListener.mockReset().mockReturnValue({ remove: removeSub });
});

describe('routeForNotification', () => {
  it('maps the payload types functions/push.js sends to their screens', () => {
    expect(routeForNotification({ type: 'pvp_invite', fromUid: 'x' })).toBe('/(app)/me');
    expect(routeForNotification({ type: 'friend_request' })).toBe('/(app)/friends');
  });

  it('returns null for unknown or missing payloads', () => {
    expect(routeForNotification({ type: 'someday_new_type' })).toBeNull();
    expect(routeForNotification({})).toBeNull();
    expect(routeForNotification(null)).toBeNull();
    expect(routeForNotification(undefined)).toBeNull();
    expect(routeForNotification('pvp_invite')).toBeNull();
  });
});

describe('observeNotificationTaps', () => {
  it('navigates for the cold-start tap that launched the app', async () => {
    mockGetLastResponse.mockResolvedValue(tap('cold-1', { type: 'pvp_invite', fromUid: 'abc' }));
    const navigate = jest.fn();
    observeNotificationTaps(navigate);
    await flush();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/(app)/me');
  });

  it('navigates for taps received while the app is running', async () => {
    const navigate = jest.fn();
    observeNotificationTaps(navigate);
    await flush();
    const listener = mockAddListener.mock.calls[0][0] as (r: TapResponse) => void;
    listener(tap('warm-1', { type: 'friend_request' }));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/(app)/friends');
  });

  it('never navigates twice for the same tap (launch tap replayed via the listener)', async () => {
    const launch = tap('dupe-1', { type: 'pvp_invite' });
    mockGetLastResponse.mockResolvedValue(launch);
    const navigate = jest.fn();
    observeNotificationTaps(navigate);
    await flush();
    const listener = mockAddListener.mock.calls[0][0] as (r: TapResponse) => void;
    listener(launch);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('ignores payloads it has no route for', async () => {
    mockGetLastResponse.mockResolvedValue(tap('odd-1', { type: 'mystery' }));
    const navigate = jest.fn();
    observeNotificationTaps(navigate);
    await flush();
    const listener = mockAddListener.mock.calls[0][0] as (r: TapResponse) => void;
    listener(tap('odd-2', undefined));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('stops routing after unsubscribe, even for an in-flight launch response', async () => {
    let resolveLast!: (r: TapResponse) => void;
    mockGetLastResponse.mockReturnValue(new Promise((res) => { resolveLast = res; }));
    const navigate = jest.fn();
    const unsub = observeNotificationTaps(navigate);
    unsub();
    expect(removeSub).toHaveBeenCalledTimes(1);
    resolveLast(tap('late-1', { type: 'pvp_invite' }));
    await flush();
    expect(navigate).not.toHaveBeenCalled();
  });
});
