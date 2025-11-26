/**
 * GLOBAL QUEUE SYSTEM FOR PONG
 * - Single global queue for all players
 * - Automatic pairing of first two players
 * - Auto-assignment to available screens
 * - Winner stays, loser returns to queue
 */

// Global player queue (not per-screen)
let globalQueue = [];

// Active games per screen: { screenId: { player1Id, player2Id, winnerId } }
let activeGames = {};

// Display sockets per screen
let displaySockets = {};

// Available screen IDs (configured)
const SCREEN_IDS = ["display_1", "display_2", "display_3"];

/**
 * Add player to global queue
 */
function addToQueue(playerId) {
  if (!globalQueue.includes(playerId)) {
    globalQueue.push(playerId);
    console.log(`Player ${playerId} added to queue. Queue length: ${globalQueue.length}`);
    return true;
  }
  return false;
}

/**
 * Remove player from global queue
 */
function removeFromQueue(playerId) {
  const index = globalQueue.indexOf(playerId);
  if (index > -1) {
    globalQueue.splice(index, 1);
    console.log(`Player ${playerId} removed from queue. Queue length: ${globalQueue.length}`);
    return true;
  }
  return false;
}

/**
 * Get player's position in global queue
 */
function getQueuePosition(playerId) {
  const index = globalQueue.indexOf(playerId);
  if (index === -1) return null;
  return index + 1; // 1-indexed for display
}

/**
 * Get total queue length
 */
function getQueueLength() {
  return globalQueue.length;
}

/**
 * Check if player is currently playing
 */
function isPlayerPlaying(playerId) {
  for (const screenId in activeGames) {
    const game = activeGames[screenId];
    if (game.player1Id === playerId || game.player2Id === playerId) {
      return { playing: true, screenId };
    }
  }
  return { playing: false };
}

/**
 * Get next available screen (no active game AND display connected)
 */
function getAvailableScreen() {
  for (const screenId of SCREEN_IDS) {
    // Check if display is connected
    const displayConnected = !!displaySockets[screenId];

    // Check if screen has no active game
    const noActiveGame = !activeGames[screenId] || !activeGames[screenId].player1Id;

    if (displayConnected && noActiveGame) {
      return screenId;
    }
  }
  return null;
}

/**
 * Get screen with winner waiting for challenger
 */
function getScreenWithWaitingWinner() {
  console.log("🔍 Looking for waiting winner...");

  for (const screenId of SCREEN_IDS) {
    const game = activeGames[screenId];
    const displayConnected = !!displaySockets[screenId];

    console.log(`   Checking ${screenId}:`);
    console.log(`     Game exists: ${!!game}`);
    console.log(`     Display connected: ${displayConnected}`);

    if (game) {
      console.log(`     winnerId: ${game.winnerId}`);
      console.log(`     player1Id: ${game.player1Id}`);
      console.log(`     player2Id: ${game.player2Id}`);
    }

    // Screen has a winner waiting and display is connected
    // Winner waiting means: winnerId is set AND one of the player slots is empty
    if (game && game.winnerId && displayConnected) {
      // Check which player is the winner and which slot is empty
      if (game.player1Id && !game.player2Id) {
        // Player1 is winner, waiting for player2
        console.log(`   ✅ FOUND waiting winner on ${screenId}: P1=${game.player1Id}, P2 slot empty`);
        return {
          screenId,
          winnerId: game.player1Id, // Screen namespace socket ID
          winnerPosition: 1,
          emptyPosition: 2,
        };
      } else if (game.player2Id && !game.player1Id) {
        // Player2 is winner, waiting for player1
        console.log(`   ✅ FOUND waiting winner on ${screenId}: P2=${game.player2Id}, P1 slot empty`);
        return {
          screenId,
          winnerId: game.player2Id, // Screen namespace socket ID
          winnerPosition: 2,
          emptyPosition: 1,
        };
      } else {
        console.log(`   ⚠️ winnerId set but both/neither slots filled - skip`);
      }
    }
  }

  console.log("   ❌ No waiting winner found");
  return null;
}

/**
 * Get next pair of players from queue
 * PRIORITY 1: Match single player with waiting winner
 * PRIORITY 2: Match two players from queue
 * Returns null if not enough players
 */
function getNextPair() {
  console.log("\n🎯 getNextPair called:");
  console.log(`   Queue length: ${globalQueue.length}`);
  console.log(`   Queue: [${globalQueue.join(", ")}]`);

  // PRIORITY 1: Check if any winner is waiting for challenger
  const waitingWinner = getScreenWithWaitingWinner();

  if (waitingWinner) {
    console.log(`   Found waiting winner: ${waitingWinner.winnerId} on ${waitingWinner.screenId}`);

    if (globalQueue.length > 0) {
      // Match next player in queue with waiting winner
      const challengerId = globalQueue.shift();

      console.log(
        `🆚 REMATCH: Challenger ${challengerId} vs waiting winner (P${waitingWinner.winnerPosition}) on ${waitingWinner.screenId}`
      );
      console.log(`   Queue after shift: [${globalQueue.join(", ")}]`);

      return {
        winnerId: waitingWinner.winnerId, // Screen socket ID of winner
        challengerId: challengerId, // Main socket ID of challenger
        winnerPosition: waitingWinner.winnerPosition, // 1 or 2
        challengerPosition: waitingWinner.emptyPosition, // 2 or 1
        screenId: waitingWinner.screenId,
        isRematch: true,
      };
    } else {
      console.log(`   ⚠️ Waiting winner found but queue empty - no match possible`);
      return null;
    }
  }

  // PRIORITY 2: Match two new players from queue
  if (globalQueue.length < 2) {
    console.log(`   ❌ Not enough players in queue for new match (need 2, have ${globalQueue.length})`);
    return null;
  }

  const player1Id = globalQueue.shift();
  const player2Id = globalQueue.shift();

  console.log(`👥 NEW MATCH: ${player1Id} vs ${player2Id}`);
  console.log(`   Queue after shifts: [${globalQueue.join(", ")}]`);

  return { player1Id, player2Id, isRematch: false };
}

/**
 * Assign pair to available screen
 * If screenId provided (rematch), use that screen
 */
function assignPairToScreen(player1Id, player2Id, preferredScreenId = null) {
  let screenId = preferredScreenId;

  // If no preferred screen or preferred not available, get available one
  if (!screenId) {
    screenId = getAvailableScreen();
  }

  if (!screenId) {
    console.error("No available screens!");
    // Return players to queue
    globalQueue.unshift(player2Id, player1Id);
    return null;
  }

  activeGames[screenId] = {
    player1Id,
    player2Id,
    winnerId: null,
    startedAt: Date.now(),
  };

  console.log(`Assigned pair to ${screenId}: ${player1Id} vs ${player2Id}`);

  return screenId;
}

/**
 * Handle game over - winner stays, loser returns to queue
 * Returns main namespace socket IDs for matchmaking
 */
function handleGameOver(screenId, winnerId, loserId) {
  const game = activeGames[screenId];

  if (!game) {
    console.error(`No active game on ${screenId}`);
    return null;
  }

  // Winner stays on screen - mark them as waiting
  game.winnerId = winnerId;

  console.log(`✅ Game over on ${screenId}. Winner: ${winnerId} (waiting), Loser: ${loserId} (to queue)`);

  // Loser returns to end of queue
  addToQueue(loserId);

  // Clear the losing player's slot ONLY
  // Winner keeps their slot (player1Id or player2Id stays)
  // Loser's slot becomes null
  if (game.player1Id === winnerId) {
    // Winner is player1, so loser must be player2
    console.log(`   Winner in P1 slot, clearing P2 slot (loser)`);
    game.player2Id = null;
  } else if (game.player2Id === winnerId) {
    // Winner is player2, so loser must be player1
    console.log(`   Winner in P2 slot, clearing P1 slot (loser)`);
    game.player1Id = null;
  } else {
    console.error(`   ⚠️ ERROR: Winner ${winnerId} not found in game slots!`);
    console.error(`   P1: ${game.player1Id}, P2: ${game.player2Id}`);
  }

  console.log(`   ⏳ Winner ${winnerId} now waiting for challenger (winnerId=${game.winnerId})`);
  console.log(`   📊 Queue length: ${globalQueue.length}`);

  // Return simple result - NO matchmaking here!
  // tryMatchPlayers() will handle matching winner with queue
  return {
    winnerId,
    screenId,
  };
}

/**
 * Remove player completely (disconnect)
 */
function removePlayer(playerId) {
  // Remove from queue
  removeFromQueue(playerId);

  // Check if player is in active game
  for (const screenId in activeGames) {
    const game = activeGames[screenId];

    if (game.player1Id === playerId) {
      // Player 1 disconnected
      if (game.player2Id) {
        // Player 2 wins by forfeit
        return handleGameOver(screenId, game.player2Id, playerId);
      } else {
        // No opponent, clear game
        delete activeGames[screenId];
        return { screenId, cleared: true };
      }
    }

    if (game.player2Id === playerId) {
      // Player 2 disconnected
      if (game.player1Id) {
        // Player 1 wins by forfeit
        return handleGameOver(screenId, game.player1Id, playerId);
      } else {
        // No opponent, clear game
        delete activeGames[screenId];
        return { screenId, cleared: true };
      }
    }
  }

  return null;
}

/**
 * Get game info for a screen
 */
function getGameForScreen(screenId) {
  return activeGames[screenId] || null;
}

/**
 * Get screen for player
 */
function getScreenForPlayer(playerId) {
  for (const screenId in activeGames) {
    const game = activeGames[screenId];
    if (game.player1Id === playerId || game.player2Id === playerId) {
      return screenId;
    }
  }
  return null;
}

/**
 * Update player's socket ID when they connect to screen namespace
 * This is needed because Socket.IO creates different socket.id for each namespace
 */
function updatePlayerSocketId(oldSocketId, newSocketId, screenId) {
  const game = activeGames[screenId];

  if (!game) {
    console.log(`No game found on ${screenId} to update socket ID`);
    return false;
  }

  let updated = false;

  if (game.player1Id === oldSocketId) {
    console.log(`Updating player1 socket ID: ${oldSocketId} -> ${newSocketId}`);
    game.player1Id = newSocketId;
    updated = true;
  } else if (game.player2Id === oldSocketId) {
    console.log(`Updating player2 socket ID: ${oldSocketId} -> ${newSocketId}`);
    game.player2Id = newSocketId;
    updated = true;
  }

  return updated;
}

/**
 * Set display socket
 */
function setDisplaySocket(screenId, socket) {
  displaySockets[screenId] = socket;
}

/**
 * Get display socket
 */
function getDisplaySocket(screenId) {
  return displaySockets[screenId];
}

/**
 * Get all display sockets
 */
function getAllDisplaySockets() {
  return displaySockets;
}

/**
 * Get status for all screens (for landing page)
 */
function getAllScreenStatuses() {
  return SCREEN_IDS.map((screenId) => {
    const game = activeGames[screenId];
    const display = displaySockets[screenId];

    return {
      id: screenId,
      displayConnected: !!display,
      gameActive: !!game && !!game.player1Id && !!game.player2Id,
      player1Id: game?.player1Id || null,
      player2Id: game?.player2Id || null,
      waitingForChallenger: !!game && !!game.winnerId && !game.player2Id,
    };
  });
}

/**
 * Get global queue status
 */
function getGlobalQueueStatus() {
  return {
    queueLength: globalQueue.length,
    players: globalQueue.map((playerId, index) => ({
      playerId,
      position: index + 1,
    })),
  };
}

/**
 * Clear game on screen
 */
function clearScreen(screenId) {
  delete activeGames[screenId];
}

export {
  // Queue management
  addToQueue,
  removeFromQueue,
  removePlayer,
  updatePlayerSocketId,
  getQueuePosition,
  getQueueLength,
  getGlobalQueueStatus,

  // Pairing
  getNextPair,
  assignPairToScreen,
  getAvailableScreen,
  getScreenWithWaitingWinner,

  // Game management
  handleGameOver,
  getGameForScreen,
  getScreenForPlayer,
  isPlayerPlaying,
  clearScreen,

  // Display management
  setDisplaySocket,
  getDisplaySocket,
  getAllDisplaySockets,
  getAllScreenStatuses,

  // Constants
  SCREEN_IDS,
};
