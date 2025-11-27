import { PONG_CONFIG } from "../../config.js";
import { resetBall } from "./physics.js";

/**
 * Create initial Pong game state
 * @param {String} player1Id - Socket ID of player 1
 * @param {String} player2Id - Socket ID of player 2
 * @param {String} player1SocketId - Socket ID for communication
 * @param {String} player2SocketId - Socket ID for communication
 */
const createInitialState = (
  player1Id = null,
  player2Id = null,
  player1SocketId = null,
  player2SocketId = null
) => {
  const {
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    PADDLE_HEIGHT,
    BALL_RADIUS,
    BALL_INITIAL_SPEED,
  } = PONG_CONFIG;

  const initialState = {
    // Players
    player1: {
      id: player1Id,
      socketId: player1SocketId,
      score: 0,
      paddleY: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
      paddleVelocity: 0,
    },
    player2: {
      id: player2Id,
      socketId: player2SocketId,
      score: 0,
      paddleY: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
      paddleVelocity: 0,
    },

    // Ball
    ball: {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      velocityX: BALL_INITIAL_SPEED,
      velocityY: 0,
      speed: BALL_INITIAL_SPEED,
      radius: BALL_RADIUS,
    },

    // Game state
    gameActive: false,
    servingPlayer: 1,
    isServing: false,
    isPaused: false,
    lastGameState: null,
    replayTimeout: null,
    isWaitingForReplay: false,
  };

  // Initialize ball direction
  resetBall(initialState.ball, 1, 0);

  return initialState;
};

let activeGames = {};
let gameMovesHistory = {};

function getCurrentGame(id) {
  if (!activeGames[id]) {
    activeGames[id] = createInitialState();
  }
  return activeGames[id];
}

/**
 * Create a new game with two players
 * @param {String} id - Display/screen ID
 * @param {String} player1Id - Player 1 socket ID
 * @param {String} player2Id - Player 2 socket ID
 */
function createNewGame(id, player1Id, player2Id) {
  activeGames[id] = createInitialState(player1Id, player2Id, player1Id, player2Id);
  gameMovesHistory[id] = [];
  return activeGames[id];
}

/**
 * Update game with new players (for winner-stays scenario)
 * @param {String} id - Display ID
 * @param {String} winnerId - Winner's socket ID (stays as player)
 * @param {String} newPlayerId - New challenger's socket ID
 * @param {Number} winnerPosition - 1 or 2 (which side winner stays on)
 */
function updateGamePlayers(id, winnerId, newPlayerId, winnerPosition = 1) {
  const game = getCurrentGame(id);

  if (winnerPosition === 1) {
    // Winner stays as player 1
    game.player1 = {
      id: winnerId,
      socketId: winnerId,
      score: 0,
      paddleY: PONG_CONFIG.CANVAS_HEIGHT / 2 - PONG_CONFIG.PADDLE_HEIGHT / 2,
      paddleVelocity: 0,
    };
    game.player2 = {
      id: newPlayerId,
      socketId: newPlayerId,
      score: 0,
      paddleY: PONG_CONFIG.CANVAS_HEIGHT / 2 - PONG_CONFIG.PADDLE_HEIGHT / 2,
      paddleVelocity: 0,
    };
  } else {
    // Winner stays as player 2
    game.player1 = {
      id: newPlayerId,
      socketId: newPlayerId,
      score: 0,
      paddleY: PONG_CONFIG.CANVAS_HEIGHT / 2 - PONG_CONFIG.PADDLE_HEIGHT / 2,
      paddleVelocity: 0,
    };
    game.player2 = {
      id: winnerId,
      socketId: winnerId,
      score: 0,
      paddleY: PONG_CONFIG.CANVAS_HEIGHT / 2 - PONG_CONFIG.PADDLE_HEIGHT / 2,
      paddleVelocity: 0,
    };
  }

  resetBall(game.ball, 1, 0);
  game.gameActive = false;
  game.servingPlayer = 1;
  gameMovesHistory[id] = [];

  return game;
}

function getMovesHistory(id) {
  return gameMovesHistory[id];
}

// Record game state for replay
function recordGameMove(id) {
  if (!gameMovesHistory[id]) {
    gameMovesHistory[id] = [];
  }
  const currentGame = activeGames[id];

  gameMovesHistory[id].push({
    player1: {
      paddleY: currentGame.player1.paddleY,
      score: currentGame.player1.score,
    },
    player2: {
      paddleY: currentGame.player2.paddleY,
      score: currentGame.player2.score,
    },
    ball: {
      x: currentGame.ball.x,
      y: currentGame.ball.y,
    },
  });
}

function resetGame(id, player1Id = null, player2Id = null) {
  if (player1Id && player2Id) {
    activeGames[id] = createInitialState(player1Id, player2Id, player1Id, player2Id);
  } else {
    activeGames[id] = createInitialState();
  }
  gameMovesHistory[id] = [];
}

/**
 * Clear game state completely
 */
function clearGame(id) {
  delete activeGames[id];
  delete gameMovesHistory[id];
}

export {
  getCurrentGame,
  createNewGame,
  updateGamePlayers,
  getMovesHistory,
  recordGameMove,
  resetGame,
  clearGame,
};
