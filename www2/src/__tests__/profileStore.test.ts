jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { useProfileStore } from '../stores/profileStore';

describe('profileStore', () => {
  beforeEach(() => {
    useProfileStore.setState({ uid: 0, name: '', lastSeed: 1, level: 1, specialEnabled: false, parts: [] });
  });

  it('creates a default profile with 50 parts and Juz2 Amma checked', () => {
    useProfileStore.getState().makeDefaultProfile();
    const state = useProfileStore.getState();

    expect(state.parts).toHaveLength(50);
    expect(state.parts[49].checked).toBe(true);
    expect(state.getTotalStudyLength()).toBeGreaterThan(0);
  });

  it('serializes to cloud profile and applies changes', () => {
    useProfileStore.getState().makeDefaultProfile();
    const state = useProfileStore.getState();
    const cloud = state.toCloudProfile();

    expect(cloud.parts).toEqual(state.parts);
    expect(cloud.name).toBe('');

    state.applyCloudProfile({ name: 'Test User', level: 2 });
    expect(useProfileStore.getState().name).toBe('Test User');
    expect(useProfileStore.getState().level).toBe(2);
  });
});
