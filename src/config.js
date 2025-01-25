export const RECONNECT_WAIT = 10 * 1000; // 20 seconds
export const DEFAULT_BLOCK_SIZE = 51;
export const SCREEN_SIZE = { rows: 35, cols: 12 };
export const STROKE = 4;
export const MAX_LEVEL = 10;

export const COLORS = {
  0: "#111", // Empty cell
  1: "#00f0f0", // I piece (cyan)
  2: "#0000f0", // J piece (blue)
  3: "#f0a000", // L piece (orange)
  4: "#f0f000", // O piece (yellow)
  5: "#00f000", // S piece (green)
  6: "#f00000", // Z piece (red)
  7: "#a000f0", // T piece (purple)
  8: "#bbb", // UI (gray)
};

export const DROP_SPEEDS = {
  1: 220, // Level 1: 0.5 seconds
  2: 180, // Level 2: 0.45 seconds
  3: 100, // Level 3: 0.4 seconds
  4: 80, // Level 4: 0.35 seconds
  5: 50, // Level 5: 0.3 seconds
  6: 20, // Level 6: 0.25 seconds
  7: 10, // Level 7: 0.2 seconds
  8: 10, // Level 8: 0.15 seconds
  9: 10, // Level 9: 0.1 seconds
  10: 10, // Level 10: 0.05 seconds
};
