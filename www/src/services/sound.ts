// Answer-feedback sound effects — a short chime on correct, a short buzz on
// incorrect. Built on expo-av (already the project's only audio/video
// dependency option — there was no expo-av/expo-audio in package.json before
// this feature, so this adds expo-av rather than a second, redundant library).
// expo-av supports web too (via its ExponentAV.web shim), so this is not
// gated behind a native-only check the way haptics is.
//
// The two source files are small synthesized WAV tones (no external assets
// fetched) under assets/sounds/ — see that directory's generation notes.

import { Audio } from 'expo-av';

let correctSound: Audio.Sound | null = null;
let incorrectSound: Audio.Sound | null = null;
let loadPromise: Promise<void> | null = null;

function ensureLoaded(): Promise<void> {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const [{ sound: c }, { sound: i }] = await Promise.all([
          Audio.Sound.createAsync(require('../../assets/sounds/correct.wav')),
          Audio.Sound.createAsync(require('../../assets/sounds/incorrect.wav')),
        ]);
        correctSound = c;
        incorrectSound = i;
      } catch (e) {
        console.error('sound preload error:', e);
      }
    })();
  }
  return loadPromise;
}

export async function playCorrectSound(): Promise<void> {
  try {
    await ensureLoaded();
    // replayAsync() restarts from position 0 — correct for rapid repeat taps.
    await correctSound?.replayAsync();
  } catch { /* audio is non-critical to the quiz flow */ }
}

export async function playIncorrectSound(): Promise<void> {
  try {
    await ensureLoaded();
    await incorrectSound?.replayAsync();
  } catch { /* audio is non-critical to the quiz flow */ }
}
