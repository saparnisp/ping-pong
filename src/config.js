export const RECONNECT_WAIT = 10 * 1000; // 20 seconds
export const DEFAULT_BLOCK_SIZE = 51;
export const SCREEN_SIZE = { rows: 35, cols: 12 };
export const STROKE = 4;
export const MAX_LEVEL = 10;
export const LINES_PER_LEVEL = 4; // Number of lines needed to advance to next level

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
  1: 210,  // 0.21 seconds
  2: 170,  // 0.17 seconds
  3: 140,  // 0.14 seconds
  4: 110,  // 0.11 seconds  
  5: 80,   // 0.08 seconds
  6: 60,   // 0.06 seconds
  7: 45,   // 0.045 seconds
  8: 30,   // 0.03 seconds
  9: 20,   // 0.02 seconds
  10: 10   // 0.01 seconds
 };