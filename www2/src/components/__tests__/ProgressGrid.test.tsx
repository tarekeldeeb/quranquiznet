import React from 'react';
import { render } from '@testing-library/react-native';
import ProgressGrid from '../ProgressGrid';

// Mock the store
jest.mock('../../store/useProfileStore', () => ({
  useProfileStore: (selector: any) => selector({
    parts: Array(50).fill(0).map((_, i) => i === 0 ? 1 : 0)
  })
}));

describe('ProgressGrid', () => {
  test('renders 50 parts', () => {
    const { getAllByText } = render(<ProgressGrid />);
    // Part numbers are 1 to 50
    expect(getAllByText(/[0-9]+/).length).toBe(50);
  });
});
