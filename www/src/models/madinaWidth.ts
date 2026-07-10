// quran-madina-html (>= 0.10) can render at any font size 6-100 by linearly
// interpolating between two "anchor" DB sizes it fetches (16px and 24px for
// us — see scripts/sync-madina-assets.mjs), instead of only the exact size of
// a pre-built DB. Below that version it was locked to a fixed 24px, whose
// rendered width (line_width 410 + 10 padding = 420px, from the bundled
// assets/db/Madina05-Hafs-24px/manifest.json "line_width" field) overflows
// the card on any phone narrower than ~452px logical width (CARD_W = 420 +
// QuizCard's 32px outer margin) — most phones. Picking a smaller font size
// for narrow screens keeps the render within the card instead.
//
// The relationship is the same linear interpolation the library itself uses
// internally (see its anchor-interpolation logic), read here from the same
// two manifests so this only needs updating if the pinned "Hafs" DB's own
// metrics change on a version bump:
//   assets/db/Madina05-Hafs-16px/manifest.json: font_size 16, line_width 270
//   assets/db/Madina05-Hafs-24px/manifest.json: font_size 24, line_width 410
const ANCHOR_LO = { fontSize: 16, lineWidth: 270 };
const ANCHOR_HI = { fontSize: 24, lineWidth: 410 };
// The library sets the rendered element's own CSS width to line_width + 10px.
const WIDTH_PADDING = 10;
// Never render larger than the pre-0.10 fixed size (matches the existing
// design on screens with room to spare) or smaller than stays legible.
const MAX_FONT_SIZE = ANCHOR_HI.fontSize;
const MIN_FONT_SIZE = 13;

const SLOPE = (ANCHOR_HI.lineWidth - ANCHOR_LO.lineWidth) / (ANCHOR_HI.fontSize - ANCHOR_LO.fontSize);

// Largest font size (rounded down, whole px) whose rendered width fits within
// `availableWidth`, clamped to [MIN_FONT_SIZE, MAX_FONT_SIZE].
export function madinaFontSizeForWidth(availableWidth: number): number {
  const targetLineWidth = availableWidth - WIDTH_PADDING;
  const raw = ANCHOR_LO.fontSize + (targetLineWidth - ANCHOR_LO.lineWidth) / SLOPE;
  return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, Math.floor(raw)));
}
