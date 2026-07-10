import { madinaFontSizeForWidth } from '../madinaWidth';

// The two anchor manifests this all derives from (see madinaWidth.ts):
// Madina05-Hafs-16px → line_width 270, Madina05-Hafs-24px → line_width 410.
// Rendered element width = line_width + 10.

describe('madinaFontSizeForWidth', () => {
  // Below this, even the 13px floor (chosen for legibility, not fit — see
  // madinaWidth.ts) overflows; no real phone's card content area gets this
  // narrow (would need a screen under ~290px wide), so it's an accepted
  // tradeoff rather than a real-world case the fit guarantee needs to cover.
  const NARROWEST_WIDTH_THE_FLOOR_STILL_FITS = 228;

  it('never picks a font size whose rendered width exceeds the available width', () => {
    for (let w = NARROWEST_WIDTH_THE_FLOOR_STILL_FITS; w <= 500; w += 1) {
      const fontSize = madinaFontSizeForWidth(w);
      // Same linear formula the library itself uses to interpolate line_width
      // from font size (see madinaWidth.ts) — reproduced here independently
      // rather than importing internals, so this actually catches a broken
      // formula instead of just echoing it back.
      const lineWidth = 270 + (fontSize - 16) * ((410 - 270) / (24 - 16));
      expect(lineWidth + 10).toBeLessThanOrEqual(w);
    }
  });

  it('accepts overflow rather than shrinking past the legibility floor on an unrealistically narrow width', () => {
    expect(madinaFontSizeForWidth(100)).toBe(13);
  });

  it('caps at 24 — the pre-0.10 fixed size — even with plenty of room to spare', () => {
    expect(madinaFontSizeForWidth(1000)).toBe(24);
  });

  it('floors at 13 rather than shrinking indefinitely on an absurdly narrow width', () => {
    expect(madinaFontSizeForWidth(0)).toBe(13);
    expect(madinaFontSizeForWidth(-100)).toBe(13);
  });

  it('picks exactly 24 for the width the old fixed size needed (420px)', () => {
    expect(madinaFontSizeForWidth(420)).toBe(24);
  });

  it('shrinks below 24 once the available width drops under the old fixed requirement', () => {
    expect(madinaFontSizeForWidth(419)).toBeLessThan(24);
  });
});
