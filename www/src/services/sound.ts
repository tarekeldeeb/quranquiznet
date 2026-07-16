// Answer-feedback sound effects — a short chime on correct, a short buzz on
// incorrect. Built on expo-audio (expo-av's replacement; expo-av is
// deprecated as of SDK 54 and is being removed). expo-audio supports web too
// (an HTMLAudio-backed shim), so this is not gated behind a native-only
// check the way haptics is.
//
// The two source files are small synthesized WAV tones (no external assets
// fetched) under assets/sounds/ — see that directory's generation notes.

import { createAudioPlayer, type AudioPlayer, type AudioStatus } from 'expo-audio';

let correctPlayer: AudioPlayer | null = null;
let incorrectPlayer: AudioPlayer | null = null;
let loadPromise: Promise<void> | null = null;

function waitForLoad(player: AudioPlayer): Promise<void> {
  if (player.isLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    const sub = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
      if (status.isLoaded) {
        sub.remove();
        resolve();
      }
    });
  });
}

function ensureLoaded(): Promise<void> {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        correctPlayer = createAudioPlayer(require('../../assets/sounds/correct.wav'));
        incorrectPlayer = createAudioPlayer(require('../../assets/sounds/incorrect.wav'));
        await Promise.all([waitForLoad(correctPlayer), waitForLoad(incorrectPlayer)]);
      } catch (e) {
        console.error('sound preload error:', e);
      }
    })();
  }
  return loadPromise;
}

async function replay(player: AudioPlayer | null): Promise<void> {
  if (!player) return;
  // seekTo(0) + play() restarts from position 0 — correct for rapid repeat taps.
  await player.seekTo(0);
  player.play();
}

export async function playCorrectSound(): Promise<void> {
  try {
    await ensureLoaded();
    await replay(correctPlayer);
  } catch { /* audio is non-critical to the quiz flow */ }
}

export async function playIncorrectSound(): Promise<void> {
  try {
    await ensureLoaded();
    await replay(incorrectPlayer);
  } catch { /* audio is non-critical to the quiz flow */ }
}
