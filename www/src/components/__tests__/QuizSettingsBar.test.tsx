// The daily-quiz top bar shows a progress indicator so the user knows how many
// questions remain. Progress is rendered only in daily mode.
import React from 'react';
import { render } from '@testing-library/react-native';
import QuizSettingsBar from '../QuizSettingsBar';

describe('QuizSettingsBar — daily progress', () => {
  it('shows "question X of Y" in daily mode', () => {
    const { getByText } = render(
      <QuizSettingsBar
        levelText=""
        specialEnabled={false}
        scopeNames={[]}
        scopeMode="daily"
        dailyCurrent={3}
        dailyTotal={10}
      />,
    );
    // Arabic-Indic digits — i18next's interpolation formatter locale-formats
    // every numeric interpolation value (see src/i18n/index.ts), consistent
    // with the rest of the app's Arabic number convention.
    expect(getByText('السؤال ٣ من ١٠')).toBeTruthy();
  });

  it('does not render progress when total is 0', () => {
    const { queryByText } = render(
      <QuizSettingsBar
        levelText=""
        specialEnabled={false}
        scopeNames={[]}
        scopeMode="daily"
        dailyCurrent={0}
        dailyTotal={0}
      />,
    );
    expect(queryByText(/السؤال/)).toBeNull();
  });

  it('shows no daily progress in a non-daily (random) session', () => {
    const { queryByText } = render(
      <QuizSettingsBar
        levelText="مستوى أولي"
        specialEnabled
        scopeNames={['الفاتحة']}
        scopeMode="random"
        dailyCurrent={3}
        dailyTotal={10}
      />,
    );
    expect(queryByText(/السؤال/)).toBeNull();
  });
});
