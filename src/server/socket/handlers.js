import {
  getCurrentGame,
  createNewGame,
  updateGamePlayers,
  recordGameMove,
  resetGame,
} from "../game/state.js";
import {
  updateBall,
  resetBall,
  movePaddle,
  setPaddlePosition,
  updatePaddle,
  checkGameOver,
} from "../game/physics.js";
import { addScore } from "../game/scores.js";
import {
  addToQueue,
  removePlayer,
  getNextPair,
  assignPairToScreen,
  handleGameOver as queueHandleGameOver,
  getGameForScreen,
  getScreenForPlayer,
  updatePlayerSocketId,
  setDisplaySocket,
  getDisplaySocket,
  getAllScreenStatuses,
  getGlobalQueueStatus,
  getQueuePosition,
  getScreenWithWaitingWinner,
  clearScreen,
} from "../game/queue.js";
import { PONG_CONFIG, RECONNECT_WAIT } from "../../config.js";
import {
  registerPlayerSession,
  getMainSocketId,
  getScreenSocketId,
  clearScreenSession,
  removePlayer as removePlayerSession,
  debugSessions,
} from "../game/playerSessions.js";

let gameLoops = {}; // Per-screen game loops
let reconnectTimers = {};
let serveTimers = {};
let loserConfirmTimers = {}; // Track losers waiting for confirmation

let io = null;

/**
 * Clear game loop for a screen
 */
function clearGameLoop(screenId) {
  if (gameLoops[screenId]) {
    clearInterval(gameLoops[screenId]);
    gameLoops[screenId] = null;
  }
}

/**
 * Clear serve timer
 */
function clearServeTimer(screenId) {
  if (serveTimers[screenId]) {
    clearTimeout(serveTimers[screenId]);
    serveTimers[screenId] = null;
  }
}

/**
 * Start 60 FPS game loop for a screen
 */
function startGameLoop(screenId) {
  clearGameLoop(screenId);

  const nsp = io.of(`/${screenId}`);
  const FPS = PONG_CONFIG.GAME_FPS;

  gameLoops[screenId] = setInterval(() => {
    const gameState = getCurrentGame(screenId);

    if (!gameState.gameActive) {
      return;
    }

    // Update ball position and check collisions
    const result = updateBall(gameState);

    // Update paddles with continuous movement
    updatePaddle(gameState.player1);
    updatePaddle(gameState.player2);

    // Handle scoring
    if (result.type === "score") {
      const scorer = result.scorer;

      if (scorer === 1) {
        gameState.player1.score++;
        gameState.servingPlayer = 1;
      } else {
        gameState.player2.score++;
        gameState.servingPlayer = 2;
      }

      console.log(
        `Score! ${screenId}: P1=${gameState.player1.score} P2=${gameState.player2.score}`
      );

      // Check if game is over
      const gameOverResult = checkGameOver(gameState);
      if (gameOverResult) {
        handlePongGameOver(screenId, gameOverResult);
        return;
      }

      // Pause for serve
      gameState.gameActive = false;
      nsp.emit("updateGame", gameState);
      nsp.emit("scored", {
        scorer,
        scores: { player1: gameState.player1.score, player2: gameState.player2.score },
      });

      // Resume after serve delay
      serveTimers[screenId] = setTimeout(() => {
        resetBall(gameState.ball, gameState.servingPlayer);
        gameState.gameActive = true;
        nsp.emit("updateGame", gameState);
        nsp.emit("serve", { servingPlayer: gameState.servingPlayer });
      }, PONG_CONFIG.SERVE_DELAY);
    }

    // Record state for replay
    if (gameState.gameActive) {
      recordGameMove(screenId);
    }

    // Broadcast game state
    nsp.emit("updateGame", gameState);
  }, 1000 / FPS);

  console.log(`Started game loop for ${screenId} at ${FPS} FPS`);
}

/**
 * Handle game over for Pong
 */
async function handlePongGameOver(screenId, result) {
  console.log(`Game over on ${screenId}:`, result);

  const nsp = io.of(`/${screenId}`);
  const gameState = getCurrentGame(screenId);

  // Stop game loop
  gameState.gameActive = false;
  clearGameLoop(screenId);
  clearServeTimer(screenId);

  // Notify players of game end
  nsp.to(result.winnerSocketId).emit("gameEnd", {
    won: true,
    finalScore: result.finalScore,
    message: "Laimėjai! Lauki kito priešininko...",
  });

  nsp.to(result.loserSocketId).emit("gameEnd", {
    won: false,
    finalScore: result.finalScore,
    message: "Pralaimėjai. Grįžti į eilę...",
  });

  nsp.emit("updateGame", gameState);

  // Save score
  try {
    await addScore({
      screen: screenId,
      winner: result.winnerId,
      points: result.finalScore.player1 + result.finalScore.player2,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error saving score:", error);
  }

  // Get main namespace socket IDs for queue management
  const winnerMainId = getMainSocketId(result.winnerSocketId);
  const loserMainId = getMainSocketId(result.loserSocketId);

  console.log(`📊 Game over mapping:`);
  console.log(`  Winner: screen=${result.winnerSocketId} main=${winnerMainId}`);
  console.log(`  Loser: screen=${result.loserSocketId} main=${loserMainId}`);

  // Clear loser's screen session (they return to main namespace)
  clearScreenSession(result.loserSocketId);

  // Handle winner-stays-loser-returns logic
  // This marks winner as waiting and adds loser to queue
  // Use MAIN namespace socket IDs for queue
  queueHandleGameOver(
    screenId,
    winnerMainId || result.winnerId, // Fallback to screen ID if main not found
    loserMainId || result.loserId
  );

  // Start 10-second confirmation timer for loser
  // If they don't confirm within 10 seconds, remove from queue
  if (loserMainId) {
    startLoserConfirmationTimer(loserMainId);
  }

  console.log(`🎮 Game over processed. Winner ${winnerMainId} marked as waiting.`);
  console.log(`   Loser ${loserMainId} added to queue end.`);

  // Notify winner they're waiting for next challenger
  nsp.to(result.winnerSocketId).emit("waitingForChallenger");

  // Update global queue status for all players
  broadcastQueueStatus();

  // Try to match winner with anyone currently in queue
  console.log(`🔄 Calling tryMatchPlayers to check for immediate match...`);
  tryMatchPlayers();
}

/**
 * Start countdown before game
 */
function startCountdown(screenId) {
  const nsp = io.of(`/${screenId}`);
  const gameState = getCurrentGame(screenId);

  let countdown = 3;

  nsp.emit("countdownStart", { countdown });

  const countdownInterval = setInterval(() => {
    countdown--;

    if (countdown > 0) {
      nsp.emit("countdown", { countdown });
    } else {
      clearInterval(countdownInterval);

      // Start game
      gameState.gameActive = true;
      resetBall(gameState.ball, 1);

      nsp.emit("gameStart");
      nsp.emit("updateGame", gameState);

      startGameLoop(screenId);
    }
  }, 1000);
}

/**
 * Handle player connecting
 */
function handlePlayerConnect(socket) {
  console.log(`\n👤 ========== Player connected: ${socket.id} ==========`);

  // Add to global queue
  addToQueue(socket.id);

  // Send queue position
  const position = getQueuePosition(socket.id);
  const queueStatus = getGlobalQueueStatus();

  console.log(`   Added to queue position: ${position}`);
  console.log(`   Total queue length: ${queueStatus.queueLength}`);

  socket.emit("queueUpdate", {
    position,
    queueLength: queueStatus.queueLength,
  });

  // Broadcast updated queue status
  broadcastQueueStatus();

  // Try to match players
  console.log(`   Attempting to match players...`);
  tryMatchPlayers();
  console.log("=================================================\n");
}

/**
 * Try to match players from queue
 * PRIORITY 1: Match with waiting winners (rematch)
 * PRIORITY 2: Match two new players
 */
function tryMatchPlayers() {
  console.log("\n🔄 ========== tryMatchPlayers called ==========");

  const pair = getNextPair();

  if (!pair) {
    console.log("❌ No match possible - not enough players or no waiting winners");
    console.log("============================================\n");
    return;
  }

  console.log("✅ Match found! Type:", pair.isRematch ? "REMATCH" : "NEW MATCH");

  let screenId;

  if (pair.isRematch) {
    // Rematch with waiting winner - screen already assigned
    screenId = pair.screenId;

    console.log(
      `🆚 Rematch on ${screenId}: Winner (P${pair.winnerPosition}) vs Challenger (P${pair.challengerPosition})`
    );

    // Winner is already on screen namespace (winnerId is screen socket ID)
    // Challenger is on main namespace (challengerId is main socket ID)

    const nsp = io.of(`/${screenId}`);
    const game = getGameForScreen(screenId);

    // NOW clear winnerId - we have a match!
    console.log(`   Clearing winnerId (was: ${game.winnerId}) - new match starting`);
    game.winnerId = null;
    game.startedAt = Date.now();

    // Update game with new challenger in the correct position
    if (pair.winnerPosition === 1) {
      // Winner is player1, challenger becomes player2
      game.player2Id = pair.challengerId; // Main socket ID, will be updated when challenger connects

      // Notify winner on screen namespace
      nsp.to(pair.winnerId).emit("newOpponent", {
        opponentId: pair.challengerId,
      });

      // Notify challenger on main namespace
      io.to(pair.challengerId).emit("matchFound", {
        screenId,
        opponentId: pair.winnerId,
        playerNumber: 2,
      });
    } else {
      // Winner is player2, challenger becomes player1
      game.player1Id = pair.challengerId; // Main socket ID
      game.winnerId = null;

      // Notify winner on screen namespace
      nsp.to(pair.winnerId).emit("newOpponent", {
        opponentId: pair.challengerId,
      });

      // Notify challenger on main namespace
      io.to(pair.challengerId).emit("matchFound", {
        screenId,
        opponentId: pair.winnerId,
        playerNumber: 1,
      });
    }

    // Start countdown for rematch
    setTimeout(() => {
      startCountdown(screenId);
    }, 2000);

  } else {
    // New match - assign to available screen
    screenId = assignPairToScreen(pair.player1Id, pair.player2Id);

    if (!screenId) {
      console.log("No available screens");
      return;
    }

    console.log(`👥 New match on ${screenId}: ${pair.player1Id} vs ${pair.player2Id}`);

    // Create new game
    createNewGame(screenId, pair.player1Id, pair.player2Id);

    // Notify both players on MAIN namespace (where they're currently connected)
    io.to(pair.player1Id).emit("matchFound", {
      screenId,
      opponentId: pair.player2Id,
      playerNumber: 1,
    });

    io.to(pair.player2Id).emit("matchFound", {
      screenId,
      opponentId: pair.player1Id,
      playerNumber: 2,
    });

    // Start countdown
    setTimeout(() => {
      startCountdown(screenId);
    }, 1000);
  }

  // Update queue for everyone
  broadcastQueueStatus();
}

/**
 * Handle paddle movement (legacy - for keyboard controls)
 */
function handlePaddleMove(socket, { direction }) {
  const screenId = getScreenForPlayer(socket.id);

  if (!screenId) {
    return;
  }

  const gameState = getCurrentGame(screenId);
  const game = getGameForScreen(screenId);

  if (!game) return;

  // Determine which player
  let player;
  if (game.player1Id === socket.id) {
    player = gameState.player1;
  } else if (game.player2Id === socket.id) {
    player = gameState.player2;
  } else {
    return;
  }

  // Move paddle
  movePaddle(player, direction);
}

/**
 * Handle paddle position (for touch/drag controls)
 */
function handlePaddlePosition(socket, { position }) {
  const screenId = getScreenForPlayer(socket.id);

  if (!screenId) {
    console.log("No screen for player:", socket.id);
    return;
  }

  const gameState = getCurrentGame(screenId);
  const game = getGameForScreen(screenId);

  if (!game || !gameState) {
    console.log("No game or gameState for screen:", screenId);
    return;
  }

  // Allow paddle control even when game not active (countdown, etc.)
  // This ensures responsive controls at all times

  // Determine which player
  let player;
  if (game.player1Id === socket.id) {
    player = gameState.player1;
  } else if (game.player2Id === socket.id) {
    player = gameState.player2;
  } else {
    console.log("Player not in game:", socket.id);
    return;
  }

  // Set paddle position directly
  setPaddlePosition(player, position);

  console.log(`Paddle position set for ${socket.id}: ${position.toFixed(2)} -> paddleY: ${player.paddleY.toFixed(0)}`);
}

/**
 * Handle display connection
 */
function handleDisplayConnect(socket) {
  const screenId = socket.nsp.name.replace("/", "");

  console.log(`📺 Display connected: ${screenId}`);
  setDisplaySocket(screenId, socket);

  // Send game config
  socket.emit("gameConfig", {
    ...PONG_CONFIG,
    screenId,
  });

  // Send current game state if exists
  const gameState = getCurrentGame(screenId);
  socket.emit("updateGame", gameState);

  // Broadcast updated screen statuses to landing page
  broadcastQueueStatus();
}

/**
 * Handle display disconnect
 */
function handleDisplayDisconnect(socket) {
  const screenId = socket.nsp.name.replace("/", "");

  console.log(`📺 Display disconnected: ${screenId}`);

  // Remove display from displaySockets
  setDisplaySocket(screenId, null);

  // Stop game loop for this screen
  clearGameLoop(screenId);
  clearServeTimer(screenId);

  // Get the game for this screen
  const game = getGameForScreen(screenId);

  if (game) {
    // Return both players to queue
    const mainId1 = getMainSocketId(game.player1Id) || game.player1Id;
    const mainId2 = getMainSocketId(game.player2Id) || game.player2Id;

    if (mainId1) {
      addToQueue(mainId1);
      io.to(mainId1).emit("displayDisconnected", {
        message: "Ekranas atsijungė. Grįžtate į eilę.",
      });
    }

    if (mainId2) {
      addToQueue(mainId2);
      io.to(mainId2).emit("displayDisconnected", {
        message: "Ekranas atsijungė. Grįžtate į eilę.",
      });
    }

    // Clear the game
    clearScreen(screenId);
  }

  // Broadcast updated screen statuses
  broadcastQueueStatus();

  console.log(`📺 Screen ${screenId} cleared and players returned to queue`);
}

/**
 * Handle player connection to screen namespace
 */
function handlePlayerReady(socket, { mainSocketId, playerNumber }) {
  const screenId = socket.nsp.name.replace("/", "");
  const screenSocketId = socket.id;

  console.log(`🎮 Player ready on ${screenId}: main=${mainSocketId} screen=${screenSocketId} P${playerNumber || '?'}`);

  // Register player session for tracking across namespaces
  if (mainSocketId) {
    registerPlayerSession(mainSocketId, screenSocketId, screenId, playerNumber);
  }

  // Update the socket ID mapping (main namespace ID -> screen namespace ID)
  if (mainSocketId) {
    const updated = updatePlayerSocketId(mainSocketId, screenSocketId, screenId);
    if (updated) {
      console.log(`✅ Socket ID updated successfully for screen ${screenId}`);
    } else {
      // Try updating by screen socket ID (for reconnects/rematches)
      const updated2 = updatePlayerSocketId(screenSocketId, screenSocketId, screenId);
      if (!updated2) {
        console.warn(`⚠️ Failed to update socket ID - player might not be in game yet`);
      }
    }
  } else {
    // No main socket ID provided, try screen socket ID (reconnect scenario)
    console.log(`ℹ️ No mainSocketId provided, checking screen socket ID...`);
    updatePlayerSocketId(screenSocketId, screenSocketId, screenId);
  }

  // Send game config
  socket.emit("gameConfig", {
    ...PONG_CONFIG,
    screenId,
  });

  // Send current game state if exists
  const gameState = getCurrentGame(screenId);
  if (gameState) {
    socket.emit("updateGame", gameState);
  }

  // Debug: Show all sessions
  debugSessions();
}

/**
 * Handle player disconnect
 */
function handleDisconnect(socket) {
  console.log(`Player disconnected: ${socket.id}`);

  const screenId = getScreenForPlayer(socket.id);

  if (screenId) {
    // Player was in active game on screen namespace
    const nsp = io.of(`/${screenId}`);
    nsp.emit("enableBlinking");

    // Wait for reconnect
    reconnectTimers[socket.id] = setTimeout(() => {
      console.log(`Player ${socket.id} did not reconnect, ending game`);

      // Remove player (triggers game over if in game)
      const result = removePlayer(socket.id);

      if (result) {
        // Game was forfeited
        nsp.emit("disableBlinking");
        clearGameLoop(screenId);
        clearServeTimer(screenId);
        broadcastQueueStatus();
        tryMatchPlayers();
      }
    }, RECONNECT_WAIT);
  } else {
    // Player might be in queue OR disconnecting from screen namespace after losing
    // Check if this is a main namespace socket or screen namespace socket
    const mainId = getMainSocketId(socket.id);

    if (mainId) {
      // This is a screen namespace socket - they just finished a game
      // Don't remove from queue - they're already there via handlePongGameOver
      console.log(`  Screen namespace disconnect for player with main ID: ${mainId}`);
      console.log(`  Not removing from queue - should be there already`);
      clearScreenSession(socket.id);
    } else {
      // This is a main namespace socket disconnecting
      console.log(`  Main namespace disconnect - removing from queue`);

      // Cancel any pending loser confirmation timer
      if (loserConfirmTimers[socket.id]) {
        clearTimeout(loserConfirmTimers[socket.id]);
        delete loserConfirmTimers[socket.id];
        console.log(`  Cancelled loser confirmation timer`);
      }

      removePlayer(socket.id);
      broadcastQueueStatus();
    }
  }
}

/**
 * Handle player reconnect
 */
function handleReconnect(socket) {
  console.log(`Player reconnected: ${socket.id}`);

  // Clear reconnect timer
  if (reconnectTimers[socket.id]) {
    clearTimeout(reconnectTimers[socket.id]);
    delete reconnectTimers[socket.id];
  }

  const screenId = getScreenForPlayer(socket.id);

  if (screenId) {
    const nsp = io.of(`/${screenId}`);
    nsp.emit("disableBlinking");

    // Rejoin screen
    socket.join(screenId);

    // Send current game state
    const gameState = getCurrentGame(screenId);
    const game = getGameForScreen(screenId);

    socket.emit("gameConfig", {
      ...PONG_CONFIG,
      screenId,
    });

    socket.emit("updateGame", gameState);

    if (game.player1Id === socket.id) {
      socket.emit("matchFound", {
        screenId,
        opponentId: game.player2Id,
        playerNumber: 1,
      });
    } else {
      socket.emit("matchFound", {
        screenId,
        opponentId: game.player1Id,
        playerNumber: 2,
      });
    }
  }
}

/**
 * Handle landing page stats request
 */
function handleLandingStats(socket) {
  const screenStatuses = getAllScreenStatuses();
  const queueStatus = getGlobalQueueStatus();

  socket.emit("displayStats", {
    screens: screenStatuses,
    queue: queueStatus,
  });
}

/**
 * Broadcast queue status to all players
 */
function broadcastQueueStatus() {
  const queueStatus = getGlobalQueueStatus();

  // Notify all players in queue of their position
  io.emit("queueStatus", queueStatus);

  // Update landing page
  const screenStatuses = getAllScreenStatuses();
  io.emit("screenStatuses", {
    screens: screenStatuses,
    queue: queueStatus,
  });
}

/**
 * Start 10-second confirmation timer for loser
 * If they don't confirm (click PLAY), remove from queue
 */
function startLoserConfirmationTimer(playerId) {
  console.log(`⏱️ Starting 10s confirmation timer for loser: ${playerId}`);

  // Clear any existing timer for this player
  if (loserConfirmTimers[playerId]) {
    clearTimeout(loserConfirmTimers[playerId]);
  }

  // Start 10 second timer
  loserConfirmTimers[playerId] = setTimeout(() => {
    console.log(`⏰ Confirmation timer expired for ${playerId} - removing from queue`);

    // Remove from queue completely
    removePlayer(playerId);

    // Notify player they were removed (countdown on client will handle redirect)
    io.to(playerId).emit("removedFromQueue", {
      message: "Pašalinti iš eilės - nepaspaudėte ŽAISTI laiku.",
    });

    // Clean up timer
    delete loserConfirmTimers[playerId];

    // Update queue for all players
    broadcastQueueStatus();
  }, 10000); // 10 seconds
}

/**
 * Handle loser confirmation (PLAY button clicked)
 */
function handleLoserReady(socket) {
  const playerId = socket.id;

  console.log(`✅ Loser confirmed (PLAY clicked): ${playerId}`);

  // Cancel confirmation timer
  if (loserConfirmTimers[playerId]) {
    clearTimeout(loserConfirmTimers[playerId]);
    delete loserConfirmTimers[playerId];
    console.log(`  Cancelled confirmation timer for ${playerId}`);
  }

  // Player stays in queue - send updated position
  const position = getQueuePosition(playerId);
  socket.emit("queueUpdate", {
    position,
    queueLength: getGlobalQueueStatus().queueLength,
  });

  console.log(`  Player ${playerId} confirmed, position: ${position}`);

  // Try to match players (in case they can be matched now)
  tryMatchPlayers();

  // Broadcast updated queue to all players
  broadcastQueueStatus();
  console.log(`  📢 Queue status broadcast to all players`);
}

/**
 * Setup socket handlers
 */
const setup = (server) => {
  io = server;

  // Main namespace for lobby/queue
  io.on("connection", (socket) => {
    console.log("Socket connected to main namespace:", socket.id);

    socket.on("playerConnect", () => handlePlayerConnect(socket));
    socket.on("loserReady", () => handleLoserReady(socket));
    socket.on("landingStats", () => handleLandingStats(socket));
    socket.on("disconnect", () => handleDisconnect(socket));
    socket.on("reconnect", () => handleReconnect(socket));
  });

  // Create namespaces for each screen
  const SCREEN_IDS = ["display_1", "display_2", "display_3"];

  SCREEN_IDS.forEach((screenId) => {
    const nsp = io.of(`/${screenId}`);

    nsp.on("connection", (socket) => {
      console.log(`Socket connected to ${screenId}:`, socket.id);

      // Store socket type to distinguish between display and player
      let isDisplay = false;

      // Check if this is a display or player
      socket.on("displayConnect", () => {
        isDisplay = true;
        handleDisplayConnect(socket);
      });

      socket.on("playerReady", (data) => handlePlayerReady(socket, data || {}));
      socket.on("paddleMove", (data) => handlePaddleMove(socket, data));
      socket.on("paddlePosition", (data) => handlePaddlePosition(socket, data));

      socket.on("disconnect", () => {
        if (isDisplay) {
          handleDisplayDisconnect(socket);
        } else {
          handleDisconnect(socket);
        }
      });

      socket.on("reconnect", () => handleReconnect(socket));
    });
  });
};

/**
 * Clean up all game loops on server shutdown
 */
function cleanup() {
  Object.keys(gameLoops).forEach((screenId) => {
    clearGameLoop(screenId);
    clearServeTimer(screenId);
  });

  Object.keys(reconnectTimers).forEach((socketId) => {
    clearTimeout(reconnectTimers[socketId]);
  });

  Object.keys(loserConfirmTimers).forEach((playerId) => {
    clearTimeout(loserConfirmTimers[playerId]);
  });
}

export {
  setup,
  cleanup,
  handlePlayerConnect,
  handleDisplayConnect,
  handleDisplayDisconnect,
  handlePaddleMove,
  handleDisconnect,
  handleReconnect,
  handleLandingStats,
  handleLoserReady,
  tryMatchPlayers,
  broadcastQueueStatus,
};
