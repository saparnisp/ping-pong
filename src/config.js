export const RECONNECT_WAIT = 10 * 1000; // 10 seconds

// PONG GAME CONFIGURATION
// 4:3 aspect ratio (1200:900)
export const PONG_CONFIG = {
  CANVAS_WIDTH: 1200,
  CANVAS_HEIGHT: 900,

  // Paddle settings
  PADDLE_WIDTH: 15,
  PADDLE_HEIGHT: 120,
  PADDLE_SPEED: 8,
  PADDLE_OFFSET: 30, // Distance from edge

  // Ball settings
  BALL_RADIUS: 12,
  BALL_INITIAL_SPEED: 6,
  BALL_SPEED_INCREMENT: 0.3, // Speed increase per hit
  BALL_MAX_SPEED: 15,
  BALL_MIN_ANGLE: 0.2, // Minimum angle to prevent horizontal balls

  // Game settings
  WIN_SCORE: 5,
  SERVE_DELAY: 2000, // 2 seconds after scoring
  GAME_FPS: 60,

  // Colors
  PLAYER1_COLOR: "#00FFFF", // Cyan
  PLAYER2_COLOR: "#FF00FF", // Magenta
  BALL_COLOR: "#FFFFFF", // White
  BACKGROUND_COLOR: "#000000", // Black
  NET_COLOR: "rgba(255,255,255,0.3)", // Semi-transparent white
  GLOW_COLOR: "#FFFFFF",

  // Visual effects
  BALL_GLOW: 20,
  PADDLE_GLOW: 15,
  NET_DASH: [10, 15],
};

// Legacy config for compatibility (will be removed)
export const DEFAULT_BLOCK_SIZE = 51;
export const SCREEN_SIZE = { rows: 35, cols: 12 };
export const STROKE = 4;

export const COLORS = {
  0: "#111",
  1: "#00f0f0",
  2: "#0000f0",
  3: "#f0a000",
  4: "#f0f000",
  5: "#00f000",
  6: "#f00000",
  7: "#a000f0",
  8: "#bbb",
};