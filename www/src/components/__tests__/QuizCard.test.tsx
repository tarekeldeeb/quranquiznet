// Regression: a fresh/unanswered card must always show its FRONT face.
// Bug: practicing a sura (or any new session) landed on a "completed" (back)
// card because a reused QuizCard instance kept its previous flipped state, and
// with no options visible the user was stuck. The fix resets the flip whenever
// flipTrigger === 0 (an unanswered card).
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

import React from 'react';
import { StyleSheet } from 'react-native';
import { render, act } from '@testing-library/react-native';
import QuizCard, { CardData } from '../QuizCard';
import { makeEmptyQO } from '../../models/questionnaire';

function makeCard(): CardData {
  const qo = makeEmptyQO();
  qo.rounds = 1;
  qo.txt = { question: 'بِسْمِ اللَّهِ', answer: 'الرَّحْمَٰنِ الرَّحِيمِ', op: [['أ', 'ب', 'ج', 'د', 'هـ']] };
  return { index: 0, qo, answerAya: 1, wordOffset: 1, socialURL: 'https://quranquiz.net/#/ahlan/1' };
}

function props(flipTrigger: number) {
  return {
    card: makeCard(),
    isActive: true,
    score: 0,
    scoreUp: 10,
    isDailyMode: false,
    timerValue: 0,
    timerMax: 0,
    onSelectOption: jest.fn(),
    onSkip: jest.fn(),
    onScrollDown: jest.fn(),
    onReport: jest.fn(),
    round: 0,
    totalRounds: 1,
    shuffledOptions: ['أ', 'ب', 'ج', 'د', 'هـ'],
    flipTrigger,
    isCorrect: true,
  };
}

// A face is "out of flow" (stacked behind) when its style includes position:absolute.
const isAbsolute = (node: { props: { style: unknown } }) => {
  const flat = StyleSheet.flatten(node.props.style as object) as { position?: string };
  return flat?.position === 'absolute';
};

describe('QuizCard flip face', () => {
  it('an unanswered card (flipTrigger 0) shows the front in flow, back stacked', () => {
    const { getByTestId } = render(<QuizCard {...props(0)} />);
    expect(isAbsolute(getByTestId('quiz-card-front'))).toBe(false);
    expect(isAbsolute(getByTestId('quiz-card-back'))).toBe(true);
  });

  it('resets to the front when a flipped instance is reused for a new question', () => {
    jest.useFakeTimers();
    const view = render(<QuizCard {...props(2)} />); // answered ⇒ will flip to back
    act(() => { jest.advanceTimersByTime(500); });   // let the flip settle
    // After flipping, the FRONT is the stacked (absolute) face.
    expect(isAbsolute(view.getByTestId('quiz-card-front'))).toBe(true);

    // Reuse the same instance for a fresh, unanswered question.
    view.rerender(<QuizCard {...props(0)} />);
    // Fix: the card returns to its front face (front back in flow).
    expect(isAbsolute(view.getByTestId('quiz-card-front'))).toBe(false);
    expect(isAbsolute(view.getByTestId('quiz-card-back'))).toBe(true);
    jest.useRealTimers();
  });
});
