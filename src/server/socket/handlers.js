import {
  getCurrentGame,
  createNewGame,
  updateGamePlayers,
  recordGameMove,
  resetGame,
  clearGame,
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
  joinScreenQueue,
  removePlayer,
  getNextPairForScreen,
  handleGameOver as queueHandleGameOver,
  getGameForScreen,
  getScreenForPlayer,
  setDisplaySocket,
  getDisplaySocket,
  getAllScreenStatuses,
  getQueuePosition,
  getQueueLength,
  getQueuedPlayers,
  clearScreen,
  clearQueue,
  clearAllGames,
  createNewGame as queueCreateNewGame,
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

// Match confirmation tracking: { matchId: { player1Confirmed, player2Confirmed, player1Id, player2Id, screenId, timer } }
let pendingMatches = {};
let matchIdCounter = 0;

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
  console.log(`📤 Sending gameEnd to winner: ${result.winnerSocketId}`);
  nsp.to(result.winnerSocketId).emit("gameEnd", {
    won: true,
    finalScore: result.finalScore,
    message: "Laimėjai! Lauki kito priešininko...",
  });

  console.log(`📤 Sending gameEnd to loser: ${result.loserSocketId}`);
  nsp.to(result.loserSocketId).emit("gameEnd", {
    won: false,
    finalScore: result.finalScore,
    message: "Pralaimėjai. Grįžti į eilę...",
  });

  // Notify display of game over
  nsp.emit("gameOver", {
    winner: result.winner,
    finalScore: result.finalScore,
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
  // This marks winner as waiting. Loser is NOT added to queue here; they must reconnect.
  queueHandleGameOver(
    screenId,
    winnerMainId || result.winnerId, // Fallback to screen ID if main not found
    loserMainId || result.loserId
  );

  console.log(`🎮 Game over processed. Winner ${winnerMainId} marked as waiting.`);
  console.log(`   Loser ${loserMainId} removed from active game.`);

  // Notify winner they're waiting for next challenger
  nsp.to(result.winnerSocketId).emit("waitingForChallenger");

  // Update global queue status for all players
  broadcastQueueStatus();

  // Try to match winner with anyone currently in queue for THIS screen
  console.log(`🔄 Calling tryMatchOnScreen to check for immediate match on ${screenId}...`);
  tryMatchOnScreen(screenId);
}

/**
 * Start countdown before game
 */
function startCountdown(screenId) {
  const nsp = io.of(`/${screenId}`);
  const gameState = getCurrentGame(screenId);
  const game = getGameForScreen(screenId);

  // Verify both players are connected before starting countdown
  if (!gameState.player1 || !gameState.player1.socketId || !gameState.player2 || !gameState.player2.socketId) {
    console.error(`❌ Cannot start countdown: Players not fully connected`);
    console.error(`   Player1: ${gameState.player1?.socketId || 'missing'}`);
    console.error(`   Player2: ${gameState.player2?.socketId || 'missing'}`);
    return;
  }

  // Verify queue game has correct socket IDs
  if (!game || !game.player1Id || !game.player2Id) {
    console.error(`❌ Cannot start countdown: Queue game not properly set up`);
    return;
  }

  console.log(`✅ Starting countdown for ${screenId}`);
  console.log(`   Player1: ${gameState.player1.socketId}`);
  console.log(`   Player2: ${gameState.player2.socketId}`);

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

      // Clear game over state on display
      nsp.emit("gameStart");
      nsp.emit("updateGame", gameState);

      startGameLoop(screenId);
    }
  }, 1000);
}

/**
 * Handle player connecting
 */
/**
 * Handle player connecting
 */
function handlePlayerConnect(socket) {
  console.log(`\n👤 ========== Player connected: ${socket.id} ==========`);

  // Clear reconnect timer if exists (connection recovery)
  if (reconnectTimers[socket.id]) {
    console.log(`   Player reconnected! Clearing disconnect timer for ${socket.id}`);
    clearTimeout(reconnectTimers[socket.id]);
    delete reconnectTimers[socket.id];
  }

  // DO NOT auto-add to queue. Wait for joinScreen.
  console.log(`   Player connected, waiting for screen selection...`);
  console.log("=================================================\n");
}

/**
 * Handle player joining a specific screen queue
 */
function handleJoinScreen(socket, screenId) {
  console.log(`\n👤 ========== Player ${socket.id} joining screen ${screenId} ==========`);

  // Add to specific screen queue
  const added = joinScreenQueue(screenId, socket.id);

  if (added) {
    // Send queue position
    const position = getQueuePosition(screenId, socket.id);
    const queueLength = getQueueLength(screenId);

    console.log(`   Added to queue position: ${position}`);
    console.log(`   Queue length for ${screenId}: ${queueLength}`);

    socket.emit("queueUpdate", {
      position,
      queueLength,
      screenId
    });

    // Broadcast updated queue status
    broadcastQueueStatus();

    // Try to match players on THIS screen
    console.log(`   Attempting to match players on ${screenId}...`);
    tryMatchOnScreen(screenId);
  } else {
    console.log(`   Failed to add to queue (already in queue?)`);
  }
  console.log("=================================================\n");
}

/**
 * Try to match players for a specific screen
 */
function tryMatchOnScreen(screenId) {
  console.log(`\n🔄 ========== tryMatchOnScreen called for ${screenId} ==========`);

  const pair = getNextPairForScreen(screenId);

  if (!pair) {
    console.log("❌ No match possible on this screen");
    console.log("============================================\n");
    return;
  }

  console.log("✅ Match found! Type:", pair.isRematch ? "REMATCH" : "NEW MATCH");

  if (pair.isRematch) {
    // Rematch with waiting winner
    console.log(
      `🆚 Rematch on ${screenId}: Winner (P${pair.winnerPosition}) vs Challenger (P${pair.challengerPosition})`
    );

    const winnerMainSocketId = pair.winnerId;
    const challengerMainSocketId = pair.challengerId;

    // We need to get winner's SCREEN socket ID to send them matchFound
    const winnerScreenSocketId = getScreenSocketId(winnerMainSocketId);

    console.log(`   Winner: main=${winnerMainSocketId} screen=${winnerScreenSocketId || 'NOT FOUND'}`);
    console.log(`   Challenger: main=${challengerMainSocketId}`);

    if (!winnerScreenSocketId) {
      console.error(`   ❌ CRITICAL: Winner ${winnerMainSocketId} has no screen session! Cannot rematch.`);

      // FIX: Handle this gracefully
      // 1. Return challenger to queue (at the front)
      joinScreenQueue(screenId, challengerMainSocketId);
      console.log(`   ➕ Returned challenger ${challengerMainSocketId} to queue`);

      // 2. Remove the zombie winner from the game/queue to prevent blocking
      const game = getGameForScreen(screenId);
      if (game) {
        console.log(`   🗑️ Clearing zombie winner from screen ${screenId}`);
        game.winnerId = null;
        if (game.player1Id === winnerMainSocketId) game.player1Id = null;
        if (game.player2Id === winnerMainSocketId) game.player2Id = null;

        if (!game.player1Id && !game.player2Id) {
          clearScreen(screenId);
        }
      }

      // 3. Try matching again immediately
      setTimeout(() => tryMatchOnScreen(screenId), 100);
      return;
    }

    // Create pending match
    const player1Id = pair.winnerPosition === 1 ? winnerMainSocketId : challengerMainSocketId;
    const player2Id = pair.winnerPosition === 2 ? winnerMainSocketId : challengerMainSocketId;

    createPendingMatch(player1Id, player2Id, screenId, true, pair.winnerPosition, winnerScreenSocketId, challengerMainSocketId, winnerMainSocketId);

  } else {
    // New match
    console.log(`👥 New match on ${screenId}: ${pair.player1Id} vs ${pair.player2Id}`);

    // Create pending match requiring confirmation
    createPendingMatch(pair.player1Id, pair.player2Id, screenId, false);
  }

  console.log("============================================\n");
}

/**
 * Handle paddle movement (legacy - for keyboard controls)
 */
function handlePaddleMove(socket, { direction }) {
  // Get screen ID from namespace (since players are connected to screen namespace)
  const screenId = socket.nsp.name.replace("/", "");

  if (!screenId) {
    return;
  }

  const gameState = getCurrentGame(screenId);
  if (!gameState) return;

  // Determine which player by comparing SCREEN SOCKET IDs
  let player;
  if (gameState.player1 && gameState.player1.socketId === socket.id) {
    player = gameState.player1;
  } else if (gameState.player2 && gameState.player2.socketId === socket.id) {
    player = gameState.player2;
  } else {
    // Try to find by game state player ID (legacy)
    const game = getGameForScreen(screenId);
    if (game) {
      if (game.player1Id === socket.id) {
        player = gameState.player1;
      } else if (game.player2Id === socket.id) {
        player = gameState.player2;
      }
    }

    if (!player) return;
  }

  // Move paddle
  movePaddle(player, direction);
}

/**
 * Handle paddle position (for touch/drag controls)
 */
function handlePaddlePosition(socket, { position }) {
  // Get screen ID from namespace (since players are connected to screen namespace)
  const screenId = socket.nsp.name.replace("/", "");

  if (!screenId) {
    console.log("No screen for player:", socket.id);
    return;
  }

  const gameState = getCurrentGame(screenId);

  if (!gameState) {
    console.log("No gameState for screen:", screenId);
    return;
  }

  // Allow paddle control even when game not active (countdown, etc.)
  // This ensures responsive controls at all times

  // Determine which player by comparing SCREEN SOCKET IDs
  let player;
  if (gameState.player1 && gameState.player1.socketId === socket.id) {
    player = gameState.player1;
  } else if (gameState.player2 && gameState.player2.socketId === socket.id) {
    player = gameState.player2;
  } else {
    console.log("Player not recognized in gameState:", socket.id);
    console.log("P1:", gameState.player1?.socketId);
    console.log("P2:", gameState.player2?.socketId);
    return;
  }

  // Set paddle position directly
  setPaddlePosition(player, position);

  // console.log(`Paddle position set for ${socket.id}: ${position.toFixed(2)} -> paddleY: ${player.paddleY.toFixed(0)}`);
}

/**
 * Handle display connection
 */
function handleDisplayConnect(socket) {
  const screenId = socket.nsp.name.replace("/", "");

  // Check if display was already connected (reconnect scenario)
  const wasConnected = !!getDisplaySocket(screenId);

  console.log(`📺 Display connected: ${screenId} (${wasConnected ? 'RECONNECT' : 'NEW CONNECTION'})`);

  // If reconnect, clear entire queue and all games
  if (wasConnected) {
    console.log(`🔄 Display reconnected - clearing queue and resetting all games`);

    // Clear all pending matches
    Object.keys(pendingMatches).forEach((matchId) => {
      const match = pendingMatches[matchId];
      if (match.timer) {
        clearTimeout(match.timer);
      }
      delete pendingMatches[matchId];
    });
    console.log(`   Cleared all pending matches`);

    // Clear all games and queue
    clearAllGames();

    // Clear all game states
    const SCREEN_IDS = ["display_1", "display_2", "display_3"];
    SCREEN_IDS.forEach((id) => {
      clearGame(id);
      clearGameLoop(id);
      clearServeTimer(id);
    });

    // Notify all players that queue was reset
    io.emit("queueReset", {
      message: "Ekranas perkrautas. Eilė išvalyta.",
    });

    console.log(`   ✅ Queue and games cleared, all players notified`);
  }

  setDisplaySocket(screenId, socket);

  // Send game config
  socket.emit("gameConfig", {
    ...PONG_CONFIG,
    screenId,
  });

  // Send current game state if exists (will be empty after reset)
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
      joinScreenQueue(screenId, mainId1);
      io.to(mainId1).emit("displayDisconnected", {
        message: "Ekranas atsijungė. Grįžtate į eilę.",
      });
    }

    if (mainId2) {
      joinScreenQueue(screenId, mainId2);
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

  // Clear reconnect timer for this socket if exists
  if (reconnectTimers[screenSocketId]) {
    console.log(`   Clearing disconnect timer for screen socket ${screenSocketId}`);
    clearTimeout(reconnectTimers[screenSocketId]);
    delete reconnectTimers[screenSocketId];
  }

  // Also check if there's a timer for the OLD screen socket associated with this main socket
  if (mainSocketId) {
    const oldScreenSocketId = getScreenSocketId(mainSocketId);
    if (oldScreenSocketId && oldScreenSocketId !== screenSocketId && reconnectTimers[oldScreenSocketId]) {
      console.log(`   Clearing disconnect timer for OLD screen socket ${oldScreenSocketId}`);
      clearTimeout(reconnectTimers[oldScreenSocketId]);
      delete reconnectTimers[oldScreenSocketId];
    }
  }

  // Get game state and queue game FIRST
  const gameState = getCurrentGame(screenId);
  const game = getGameForScreen(screenId);

  // Register player session for tracking across namespaces
  if (mainSocketId) {
    registerPlayerSession(mainSocketId, screenSocketId, screenId, playerNumber);
  }

  // Update gameState with screen socket ID when player connects
  // Check if game exists and playerNumber is provided
  if (game && gameState && playerNumber) {
    console.log(`🔄 Updating gameState for player ${playerNumber} with screen socket ID`);

    // Check if this is a new match or rematch
    const isRematch = game.winnerId !== null && game.winnerId !== undefined;

    if (isRematch) {
      // Rematch scenario - challenger just connected
      console.log(`🔄 Rematch: Challenger connected, updating gameState`);

      // Determine winner position
      const winnerPosition = game.player1Id === game.winnerId ? 1 : 2;
      const challengerPosition = playerNumber;

      // Update gameState with new challenger
      if (challengerPosition === 1) {
        gameState.player1 = {
          id: mainSocketId || screenSocketId,
          socketId: screenSocketId,
          score: 0,
          paddleY: PONG_CONFIG.CANVAS_HEIGHT / 2 - PONG_CONFIG.PADDLE_HEIGHT / 2,
          paddleVelocity: 0,
        };
      } else {
        gameState.player2 = {
          id: mainSocketId || screenSocketId,
          socketId: screenSocketId,
          score: 0,
          paddleY: PONG_CONFIG.CANVAS_HEIGHT / 2 - PONG_CONFIG.PADDLE_HEIGHT / 2,
          paddleVelocity: 0,
        };
      }

      // Reset winner's score and position
      if (winnerPosition === 1) {
        gameState.player1.score = 0;
        gameState.player1.paddleY = PONG_CONFIG.CANVAS_HEIGHT / 2 - PONG_CONFIG.PADDLE_HEIGHT / 2;
      } else {
        gameState.player2.score = 0;
        gameState.player2.paddleY = PONG_CONFIG.CANVAS_HEIGHT / 2 - PONG_CONFIG.PADDLE_HEIGHT / 2;
      }

      resetBall(gameState.ball, 1);
      gameState.gameActive = false;
      gameState.servingPlayer = 1;
    } else {
      // New match - update gameState with screen socket ID
      console.log(`🔄 New match: Updating gameState for player ${playerNumber}`);

      // Use playerNumber as the primary identifier (sent from client via matchFound)
      if (playerNumber === 1) {
        // Update player1 with screen socket ID
        if (!gameState.player1) {
          gameState.player1 = {
            id: mainSocketId || screenSocketId,
            socketId: null,
            score: 0,
            paddleY: PONG_CONFIG.CANVAS_HEIGHT / 2 - PONG_CONFIG.PADDLE_HEIGHT / 2,
            paddleVelocity: 0,
          };
        }
        gameState.player1.id = mainSocketId || screenSocketId;
        gameState.player1.socketId = screenSocketId;

        // Ensure score is 0 if game hasn't started yet
        if (!gameState.gameActive) {
          gameState.player1.score = 0;
        }

        console.log(`   ✅ Updated player1: id=${gameState.player1.id} socketId=${gameState.player1.socketId}`);
      } else if (playerNumber === 2) {
        // Update player2 with screen socket ID
        if (!gameState.player2) {
          gameState.player2 = {
            id: mainSocketId || screenSocketId,
            socketId: null,
            score: 0,
            paddleY: PONG_CONFIG.CANVAS_HEIGHT / 2 - PONG_CONFIG.PADDLE_HEIGHT / 2,
            paddleVelocity: 0,
          };
        }
        gameState.player2.id = mainSocketId || screenSocketId;
        gameState.player2.socketId = screenSocketId;

        // Ensure score is 0 if game hasn't started yet
        if (!gameState.gameActive) {
          gameState.player2.score = 0;
        }

        console.log(`   ✅ Updated player2: id=${gameState.player2.id} socketId=${gameState.player2.socketId}`);
      } else {
        console.error(`   ❌ Invalid playerNumber: ${playerNumber}`);
      }

      // Check if both players are now connected (for new matches)
      // Both players should have screen socket IDs set
      if (gameState.player1 && gameState.player1.socketId && gameState.player2 && gameState.player2.socketId) {
        console.log(`✅ Both players connected! Player1: ${gameState.player1.socketId}, Player2: ${gameState.player2.socketId}`);

        // Check if countdown hasn't started yet (game not active)
        if (!gameState.gameActive) {
          console.log(`   ✅ Both players ready - starting countdown for new match...`);

          // Start countdown after short delay
          setTimeout(() => {
            console.log(`   🎬 Calling startCountdown for ${screenId}...`);
            startCountdown(screenId);
          }, 500);
        } else {
          console.log(`   ⚠️ Game already active, skipping countdown`);
        }
      } else {
        console.log(`⏳ Waiting for other player... Player1: ${gameState.player1?.socketId || 'not connected'}, Player2: ${gameState.player2?.socketId || 'not connected'}`);
      }
    }
  }

  // Send game config
  socket.emit("gameConfig", {
    ...PONG_CONFIG,
    screenId,
  });

  // Send current game state if exists
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
        tryMatchOnScreen(screenId);
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
  // No global queue anymore
  // const queueStatus = getGlobalQueueStatus();

  socket.emit("displayStats", {
    screens: screenStatuses,
    // queue: queueStatus,
  });
}

/**
 * Broadcast queue status to all players
 */
/**
 * Broadcast queue status to all players
 */
function broadcastQueueStatus() {
  // 1. Update landing page (all screens status)
  const screenStatuses = getAllScreenStatuses();
  io.emit("screenStatuses", { screens: screenStatuses });

  // 2. Update individual players in queues
  screenStatuses.forEach(screen => {
    const players = getQueuedPlayers(screen.id);
    players.forEach((playerId, index) => {
      io.to(playerId).emit("queueUpdate", {
        position: index + 1,
        queueLength: players.length,
        screenId: screen.id
      });
    });
  });
}

/**
 * Create a pending match that requires confirmation from both players
 */
function createPendingMatch(player1Id, player2Id, screenId, isRematch = false, winnerPosition = null, winnerScreenSocketId = null, challengerMainSocketId = null, winnerMainSocketId = null) {
  const matchId = ++matchIdCounter;

  console.log(`📋 Creating pending match ${matchId}:`);
  console.log(`   Player1: ${player1Id}`);
  console.log(`   Player2: ${player2Id}`);
  console.log(`   Screen: ${screenId}`);
  console.log(`   Is Rematch: ${isRematch}`);
  if (isRematch) {
    console.log(`   Winner Screen Socket: ${winnerScreenSocketId}`);
    console.log(`   Challenger Main Socket: ${challengerMainSocketId}`);
  }

  pendingMatches[matchId] = {
    matchId,
    player1Id,
    player2Id,
    screenId,
    isRematch,
    winnerPosition,
    winnerScreenSocketId, // Store for rematch
    challengerMainSocketId, // Store for rematch
    player1Confirmed: false,
    player2Confirmed: false,
    timer: null,
  };

  // Start 10-second confirmation timer
  pendingMatches[matchId].timer = setTimeout(() => {
    console.log(`⏰ Match ${matchId} confirmation timeout - cancelling match`);
    cancelMatchConfirmation(matchId, "Confirmation timeout");
  }, 10000);

  // Emit matchFound to both players with matchId
  if (isRematch && winnerScreenSocketId && challengerMainSocketId) {
    // Rematch: Winner is in screen namespace, challenger is in main namespace
    const nsp = io.of(`/${screenId}`);
    const winnerSocketId = winnerScreenSocketId;
    const challengerSocketId = challengerMainSocketId;

    // Send to winner (SCREEN namespace)
    console.log(`📤 Sending matchFound to winner via screen namespace: ${winnerSocketId}`);
    nsp.to(winnerSocketId).emit("matchFound", {
      matchId,
      screenId,
      opponentId: challengerMainSocketId,
      playerNumber: winnerPosition,
    });

    // NEW: Also send to winner via MAIN namespace (just in case)
    if (winnerMainSocketId) {
      console.log(`📤 Sending matchFound to winner via MAIN namespace: ${winnerMainSocketId}`);
      io.to(winnerMainSocketId).emit("matchFound", {
        matchId,
        screenId,
        opponentId: challengerMainSocketId,
        playerNumber: winnerPosition,
      });
    }

    // Send to challenger (MAIN namespace)
    console.log(`📤 Sending matchFound to challenger via main namespace: ${challengerSocketId}`);
    io.to(challengerSocketId).emit("matchFound", {
      matchId,
      screenId,
      opponentId: winnerMainSocketId, // Send main ID of winner
      playerNumber: winnerPosition === 1 ? 2 : 1,
    });
  } else {
    // New match: Both players are in main namespace
    io.to(player1Id).emit("matchFound", {
      matchId,
      screenId,
      opponentId: player2Id,
      playerNumber: 1,
    });

    io.to(player2Id).emit("matchFound", {
      matchId,
      screenId,
      opponentId: player1Id,
      playerNumber: 2,
    });
  }

  console.log(`⏱️ Match ${matchId} - waiting for confirmations (10s timeout started)`);

  return matchId;
}

/**
 * Handle player confirmation
 */
function handlePlayerConfirmed(socket) {
  const playerId = socket.id;

  console.log(`✅ Player ${playerId} confirmed readiness`);

  // Get additional IDs for this player to help matching
  const mainId = getMainSocketId(playerId) || playerId;
  const screenId = getScreenSocketId(playerId) || playerId;

  console.log(`   IDs to check: ${playerId} (direct), ${mainId} (main), ${screenId} (screen)`);

  // Find which pending match this player is in
  // Check player1Id, player2Id (main socket IDs) OR winnerScreenSocketId (rematch)
  const matchEntry = Object.values(pendingMatches).find(
    (match) =>
      match.player1Id === mainId ||
      match.player2Id === mainId ||
      (match.isRematch && match.winnerScreenSocketId === screenId) ||
      (match.isRematch && match.winnerScreenSocketId === playerId)
  );

  if (!matchEntry) {
    console.log(`⚠️ No pending match found for player ${playerId}`);
    console.log(`   Pending matches: ${Object.keys(pendingMatches).length}`);
    return;
  }

  const matchId = matchEntry.matchId;
  console.log(`   Found in match ${matchId}`);

  // Mark player as confirmed
  // Check if player matches player1 (main ID) OR winnerScreenSocketId (if winner is P1)
  if (matchEntry.player1Id === mainId || (matchEntry.isRematch && matchEntry.winnerPosition === 1 && (matchEntry.winnerScreenSocketId === playerId || matchEntry.winnerScreenSocketId === screenId))) {
    matchEntry.player1Confirmed = true;
    console.log(`   Player 1 confirmed`);
  }
  // Check if player matches player2 (main ID) OR winnerScreenSocketId (if winner is P2)
  else if (matchEntry.player2Id === mainId || (matchEntry.isRematch && matchEntry.winnerPosition === 2 && (matchEntry.winnerScreenSocketId === playerId || matchEntry.winnerScreenSocketId === screenId))) {
    matchEntry.player2Confirmed = true;
    console.log(`   Player 2 confirmed`);
  }

  // Check if both players confirmed
  checkBothPlayersReady(matchId);
}

/**
 * Check if both players confirmed and start game
 */
function checkBothPlayersReady(matchId) {
  try {
    const match = pendingMatches[matchId];

    if (!match) {
      console.log(`⚠️ Match ${matchId} not found`);
      return;
    }

    console.log(`🔍 Checking match ${matchId} confirmations:`);
    console.log(`   Player 1: ${match.player1Confirmed ? '✅' : '⏳'}`);
    console.log(`   Player 2: ${match.player2Confirmed ? '✅' : '⏳'}`);

    if (match.player1Confirmed && match.player2Confirmed) {
      console.log(`✅✅ Both players confirmed! Starting game...`);

      // Cancel timeout timer
      if (match.timer) {
        clearTimeout(match.timer);
        match.timer = null;
      }

      // Notify both players that match is starting
      if (match.isRematch && match.winnerScreenSocketId && match.challengerMainSocketId) {
        // Rematch: Send to winner via screen namespace, challenger via main namespace
        const nsp = io.of(`/${match.screenId}`);
        // Use stored winnerScreenSocketId for screen namespace communication
        const winnerSocketId = match.winnerScreenSocketId;
        const challengerSocketId = match.winnerPosition === 1 ? match.player2Id : match.player1Id;

        nsp.to(winnerSocketId).emit("bothPlayersReady", {
          screenId: match.screenId,
          playerNumber: match.winnerPosition,
        });

        io.to(challengerSocketId).emit("bothPlayersReady", {
          screenId: match.screenId,
          playerNumber: match.winnerPosition === 1 ? 2 : 1,
        });
      } else {
        // New match: Both in main namespace
        io.to(match.player1Id).emit("bothPlayersReady", {
          screenId: match.screenId,
          playerNumber: 1,
        });

        io.to(match.player2Id).emit("bothPlayersReady", {
          screenId: match.screenId,
          playerNumber: 2,
        });
      }

      // Create game and start countdown
      if (match.isRematch) {
        // Rematch - update existing game
        const game = getGameForScreen(match.screenId);
        const nsp = io.of(`/${match.screenId}`);

        if (!game) {
          console.error(`❌ Rematch error: Game not found for screen ${match.screenId}`);
          cancelMatchConfirmation(matchId, "Game error");
          return;
        }

        // Update queue game with challenger (main socket ID for now)
        // The challenger will connect to screen namespace and updatePlayerSocketId will update this
        if (match.winnerPosition === 1) {
          game.player2Id = match.player2Id; // Challenger main socket ID (will be updated when they connect)
        } else {
          game.player1Id = match.player1Id; // Challenger main socket ID (will be updated when they connect)
        }

        game.winnerId = null;
        game.startedAt = Date.now();

        // NOTE: gameState will be updated when challenger connects via handlePlayerReady
        // For now, just reset the winner's score and position
        const gameState = getCurrentGame(match.screenId);
        if (gameState) {
          // Reset winner's score but keep their position
          // Also ensure the other player's score is 0 (for the new challenger)
          if (match.winnerPosition === 1) {
            gameState.player1.score = 0;
            gameState.player1.paddleY = PONG_CONFIG.CANVAS_HEIGHT / 2 - PONG_CONFIG.PADDLE_HEIGHT / 2;
            if (gameState.player2) gameState.player2.score = 0;
          } else {
            gameState.player2.score = 0;
            gameState.player2.paddleY = PONG_CONFIG.CANVAS_HEIGHT / 2 - PONG_CONFIG.PADDLE_HEIGHT / 2;
            if (gameState.player1) gameState.player1.score = 0;
          }
          // Reset ball
          resetBall(gameState.ball, 1);
          gameState.gameActive = false;
          gameState.servingPlayer = 1;
        }

        console.log(`🆚 Rematch starting on ${match.screenId}`);

        // Start countdown after short delay for reconnection
        setTimeout(() => {
          startCountdown(match.screenId);
        }, 2000);

      } else {
        // New match - create game
        const screenId = match.screenId;

        console.log(`👥 New match starting on ${screenId}`);

        // Create game with main socket IDs (will be updated when players connect to screen namespace)
        // 1. Initialize game state (physics, scores)
        createNewGame(screenId, match.player1Id, match.player2Id);

        // 2. Register game in queue system (locks the screen)
        queueCreateNewGame(screenId, match.player1Id, match.player2Id);

        // Initialize gameState with null socket IDs - they will be set when players connect
        const gameState = getCurrentGame(screenId);
        if (gameState) {
          // Set socketId to null initially - will be updated when players connect
          gameState.player1.socketId = null;
          gameState.player2.socketId = null;
          console.log(`   Initialized gameState with null socket IDs - waiting for players to connect`);
        }

        // Don't start countdown immediately - wait for both players to connect to screen namespace
        // They will connect when they receive bothPlayersReady event
        // Countdown will start automatically when both players send playerReady
        console.log(`   Waiting for both players to connect to screen namespace...`);
      }

      // Remove from pending matches
      delete pendingMatches[matchId];
      console.log(`🗑️ Match ${matchId} removed from pending matches`);

      // Update queue status
      broadcastQueueStatus();
    } else {
      console.log(`⏳ Waiting for other player...`);
    }
  } catch (error) {
    console.error(`❌ Error in checkBothPlayersReady:`, error);
    // Try to cleanup if possible
    if (matchId) cancelMatchConfirmation(matchId, "Server error");
  }
}

/**
 * Cancel match confirmation and return players to queue
 */
function cancelMatchConfirmation(matchId, reason) {
  const match = pendingMatches[matchId];

  if (!match) {
    console.log(`⚠️ Match ${matchId} not found for cancellation`);
    return;
  }

  console.log(`❌ Cancelling match ${matchId}: ${reason}`);

  // Cancel timer if exists
  if (match.timer) {
    clearTimeout(match.timer);
    match.timer = null;
  }

  // Notify both players
  const message = reason === "Confirmation timeout"
    ? "Varžovas nepatvirtino - grįžtate į eilę"
    : reason;

  if (match.isRematch && match.winnerScreenSocketId && match.challengerMainSocketId) {
    // Rematch: Send to winner via screen namespace, challenger via main namespace
    const nsp = io.of(`/${match.screenId}`);
    const winnerSocketId = match.winnerPosition === 1 ? match.player1Id : match.player2Id;
    const challengerSocketId = match.winnerPosition === 1 ? match.player2Id : match.player1Id;

    nsp.to(winnerSocketId).emit("matchCancelled", { reason: message });
    io.to(challengerSocketId).emit("matchCancelled", { reason: message });
  } else {
    // New match: Both in main namespace
    io.to(match.player1Id).emit("matchCancelled", { reason: message });
    io.to(match.player2Id).emit("matchCancelled", { reason: message });
  }

  // Return ONLY CONFIRMED players to queue
  // Unconfirmed players are dropped (zombies or AFK)

  if (match.isRematch) {
    // Rematch logic
    const challengerId = match.winnerPosition === 1 ? match.player2Id : match.player1Id;
    const winnerId = match.winnerPosition === 1 ? match.player1Id : match.player2Id;

    // Check challenger confirmation (winner is already "confirmed" by being there, but check if they are the cause)
    // Actually, for rematch, we only really care if challenger confirmed. 
    // If winner disconnected, that's handled elsewhere usually, but if they failed to respond to some check...

    // In current logic, we only track player1Confirmed/player2Confirmed
    // For rematch, we map these based on positions.

    const challengerConfirmed = match.winnerPosition === 1 ? match.player2Confirmed : match.player1Confirmed;

    if (challengerConfirmed) {
      joinScreenQueue(match.screenId, challengerId);
      console.log(`  ➕ Returned confirmed challenger ${challigerId} to queue for ${match.screenId}`);
    } else {
      console.log(`  ⛔ Challenger ${challengerId} failed to confirm - dropping from queue`);
      io.to(challengerId).emit("matchCancelled", { reason: "Nepatvirtinote dalyvavimo - buvote pašalintas iš eilės" });
    }

    // Winner stays on screen (waiting) unless they were the problem? 
    // If winner failed to confirm (if we require that), we might want to kick them.
    // But currently handlePlayerConfirmed checks both.

  } else {
    // New match - check each player
    if (match.player1Confirmed) {
      joinScreenQueue(match.screenId, match.player1Id);
      console.log(`  ➕ Returned confirmed Player 1 (${match.player1Id}) to queue for ${match.screenId}`);
    } else {
      console.log(`  ⛔ Player 1 (${match.player1Id}) failed to confirm - dropping from queue`);
      io.to(match.player1Id).emit("matchCancelled", { reason: "Nepatvirtinote dalyvavimo - buvote pašalintas iš eilės" });
    }

    if (match.player2Confirmed) {
      joinScreenQueue(match.screenId, match.player2Id);
      console.log(`  ➕ Returned confirmed Player 2 (${match.player2Id}) to queue for ${match.screenId}`);
    } else {
      console.log(`  ⛔ Player 2 (${match.player2Id}) failed to confirm - dropping from queue`);
      io.to(match.player2Id).emit("matchCancelled", { reason: "Nepatvirtinote dalyvavimo - buvote pašalintas iš eilės" });
    }
  }

  // Remove from pending matches
  delete pendingMatches[matchId];

  // Update queue status
  broadcastQueueStatus();

  // Try matching again
  tryMatchOnScreen(match.screenId);
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
    socket.on("joinScreen", (data) => handleJoinScreen(socket, data.screenId));
    socket.on("playerConfirmed", () => handlePlayerConfirmed(socket));
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
      socket.on("playerConfirmed", () => handlePlayerConfirmed(socket)); // Allow confirmation from screen namespace for rematch
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

  Object.keys(pendingMatches).forEach((matchId) => {
    const match = pendingMatches[matchId];
    if (match.timer) {
      clearTimeout(match.timer);
    }
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
  broadcastQueueStatus,
};
