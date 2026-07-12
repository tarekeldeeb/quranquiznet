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
import QuizCard, { CardData, reachesNewSuraContent } from '../QuizCard';
import { makeEmptyQO } from '../../models/questionnaire';
import { SURA_IDX, QURAN_WORDS } from '../../models/constants';

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

// Regression: the sura decoration line (title) must stay hidden until the excerpt
// covers at least one REAL word of the new sura — i.e. one word past its basmala.
// Bug: SURA_IDX had drifted from the shipped q.json tokenization by up to 3 words,
// so the title was revealed while the basmala was still being shown word-by-word.
describe('reachesNewSuraContent', () => {
  // Al-Ma'un → Al-Kawthar boundary: Kawthar's basmala spans its first 4 words,
  // so its first real word is head+4.
  const head = SURA_IDX[106];      // first word of Al-Kawthar (its basmala start)
  const firstReal = head + 4;      // «إنا», first post-basmala word
  const tawbaHead = SURA_IDX[7];   // At-Tawba has no basmala

  it('stays hidden while the excerpt is inside one sura', () => {
    expect(reachesNewSuraContent(head - 8, head - 1)).toBe(false);
  });

  it('stays hidden while only basmala words of the new sura are shown', () => {
    expect(reachesNewSuraContent(head - 8, head + 1)).toBe(false);      // mid-basmala
    expect(reachesNewSuraContent(head - 8, firstReal - 1)).toBe(false); // basmala complete
  });

  it('is revealed with the first post-basmala word', () => {
    expect(reachesNewSuraContent(head - 8, firstReal)).toBe(true);
  });

  it('applies equally to an excerpt starting exactly at the sura head', () => {
    expect(reachesNewSuraContent(head, firstReal - 1)).toBe(false);
    expect(reachesNewSuraContent(head, firstReal)).toBe(true);
  });

  it('stays hidden when the excerpt starts past the sura head (no line rendered)', () => {
    expect(reachesNewSuraContent(head + 1, firstReal + 3)).toBe(false);
  });

  it('is revealed with the first word of a basmala-less sura (At-Tawba)', () => {
    expect(reachesNewSuraContent(tawbaHead - 5, tawbaHead)).toBe(true);
  });

  it('is revealed when the excerpt wraps past An-Nas into Al-Fatiha', () => {
    // End-of-Quran wrap (e.g. ?start=77880): the renderer continues into Al-Fatiha,
    // whose basmala is its real aya 1 — one wrapped word already earns its name.
    expect(reachesNewSuraContent(QURAN_WORDS - 1, QURAN_WORDS + 1)).toBe(true);
    expect(reachesNewSuraContent(QURAN_WORDS - 1, QURAN_WORDS)).toBe(false); // no wrap yet
  });
});

describe('QuizCard flip face', () => {
  it('an unanswered card (flipTrigger 0) shows the front in flow, back stacked', () => {
    const { getByTestId } = render(<QuizCard {...props(0)} />);
    expect(isAbsolute(getByTestId('quiz-card-front'))).toBe(false);
    expect(isAbsolute(getByTestId('quiz-card-back'))).toBe(true);
  });

  it('resets to the front when a flipped instance is reused for a new question', () => {
    jest.useFakeTimers();
    const view = render(<QuizCard {...props(2)} />); // answered ⇒ will flip to back
    // The reveal (correct/picked-wrong markers + score fly) holds the front
    // face for REVEAL_DELAY before the 420ms flip itself starts.
    act(() => { jest.advanceTimersByTime(1200); });   // let the reveal + flip settle
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
