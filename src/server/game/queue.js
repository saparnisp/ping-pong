/**
 * GLOBAL QUEUE SYSTEM FOR PONG
 * - Per-screen queues
 * - Manual selection of screens
 * - Winner stays, loser returns to SPECIFIC SCREEN queue
 */

// Screen queues: { screenId: [playerId, ...] }
let screenQueues = {
  "display_1": [],
  "display_2": [],
  "display_3": []
};

// Active games per screen: { screenId: { player1Id, player2Id, winnerId } }
// IMPORTANT: player1Id and player2Id are ALWAYS main socket IDs
let activeGames = {};

// Display sockets per screen
let displaySockets = {};

// Available screen IDs (configured)
const SCREEN_IDS = ["display_1", "display_2", "display_3"];

/**
 * Add player to specific screen queue
 */
function joinScreenQueue(screenId, playerId) {
  if (!screenQueues[screenId]) {
    console.error(`Invalid screen ID: ${screenId}`);
    return false;
  }

  // Remove from other queues first to prevent duplicates
  removeFromAllQueues(playerId);

  if (!screenQueues[screenId].includes(playerId)) {
    screenQueues[screenId].push(playerId);
    console.log(`Player ${playerId} joined queue for ${screenId}. Queue length: ${screenQueues[screenId].length}`);
    return true;
  }
  return false;
}

/**
 * Remove player from all queues
 */
function removeFromAllQueues(playerId) {
  let removed = false;
  for (const screenId of SCREEN_IDS) {
    const index = screenQueues[screenId].indexOf(playerId);
    if (index > -1) {
      screenQueues[screenId].splice(index, 1);
      console.log(`Player ${playerId} removed from ${screenId} queue.`);
      removed = true;
    }
  }
  return removed;
}

/**
 * Get player's position in specific screen queue
 */
function getQueuePosition(screenId, playerId) {
  if (!screenQueues[screenId]) return null;
  const index = screenQueues[screenId].indexOf(playerId);
  if (index === -1) return null;
  return index + 1; // 1-indexed for display
}

/**
 * Get queue length for screen
 */
function getQueueLength(screenId) {
  return screenQueues[screenId] ? screenQueues[screenId].length : 0;
}

/**
 * Get all players in queue for screen
 */
function getQueuedPlayers(screenId) {
  return screenQueues[screenId] ? [...screenQueues[screenId]] : [];
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
 * Get next pair of players for a SPECIFIC screen
 * PRIORITY 1: Match single player from queue with waiting winner
 * PRIORITY 2: Match two players from queue
 */
function getNextPairForScreen(screenId) {
  console.log(`\n🎯 getNextPairForScreen called for ${screenId}:`);
  const queue = screenQueues[screenId];

  if (!queue) {
    console.error(`   ❌ Invalid screen ID: ${screenId}`);
    return null;
  }

  console.log(`   Queue length: ${queue.length}`);
  console.log(`   Queue: [${queue.join(", ")}]`);

  const game = activeGames[screenId];
  const displayConnected = !!displaySockets[screenId];

  if (!displayConnected) {
    console.log(`   ❌ Display not connected for ${screenId}`);
    return null;
  }

  // PRIORITY 1: Check if winner is waiting
  if (game && game.winnerId) {
    // Check if P1 is winner and P2 is empty
    if (game.player1Id === game.winnerId && !game.player2Id) {
      console.log(`   ✅ Waiting winner (P1) found on ${screenId}`);

      if (queue.length > 0) {
        const challengerId = queue.shift();
        console.log(`   🆚 REMATCH: Challenger ${challengerId} vs Winner ${game.winnerId}`);

        return {
          winnerId: game.winnerId,
          challengerId: challengerId,
          winnerPosition: 1,
          challengerPosition: 2,
          screenId: screenId,
          isRematch: true,
        };
      } else {
        console.log(`   ⚠️ Waiting winner but queue empty`);
        return null;
      }
    }
    // Check if P2 is winner and P1 is empty
    else if (game.player2Id === game.winnerId && !game.player1Id) {
      console.log(`   ✅ Waiting winner (P2) found on ${screenId}`);

      if (queue.length > 0) {
        const challengerId = queue.shift();
        console.log(`   🆚 REMATCH: Challenger ${challengerId} vs Winner ${game.winnerId}`);

        return {
          winnerId: game.winnerId,
          challengerId: challengerId,
          winnerPosition: 2,
          challengerPosition: 1,
          screenId: screenId,
          isRematch: true,
        };
      } else {
        console.log(`   ⚠️ Waiting winner but queue empty`);
        return null;
      }
    }
  }

  // PRIORITY 2: Match two new players from queue
  // Only if no active game
  if (!game || (!game.player1Id && !game.player2Id)) {
    if (queue.length >= 2) {
      const player1Id = queue.shift();
      const player2Id = queue.shift();

      console.log(`   👥 NEW MATCH: ${player1Id} vs ${player2Id}`);
      return { player1Id, player2Id, screenId, isRematch: false };
    } else {
      console.log(`   ❌ Not enough players in queue (need 2, have ${queue.length})`);
      return null;
    }
  }

  console.log(`   ❌ Game already active on ${screenId}`);
  return null;
}

/**
 * Handle game over - winner stays, loser returns to SPECIFIC SCREEN queue
 */
function handleGameOver(screenId, winnerId, loserId) {
  const game = activeGames[screenId];

  if (!game) {
    console.error(`No active game on ${screenId}`);
    return null;
  }

  // Winner stays on screen - mark them as waiting
  game.winnerId = winnerId;

  console.log(`✅ Game over on ${screenId}. Winner: ${winnerId} (waiting), Loser: ${loserId}`);

  // Clear the losing player's slot ONLY
  if (game.player1Id === winnerId) {
    game.player2Id = null; // Clear P2
  } else if (game.player2Id === winnerId) {
    game.player1Id = null; // Clear P1
  }

  // Return simple result
  return {
    winnerId,
    screenId,
  };
}

/**
 * Remove player completely (disconnect)
 */
function removePlayer(playerId) {
  // Remove from all queues
  removeFromAllQueues(playerId);

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
    const queue = screenQueues[screenId] || [];

    return {
      id: screenId,
      displayConnected: !!display,
      gameActive: !!game && !!game.player1Id && !!game.player2Id,
      player1Id: game?.player1Id || null,
      player2Id: game?.player2Id || null,
      waitingForChallenger: !!game && !!game.winnerId && (!game.player1Id || !game.player2Id),
      queueLength: queue.length
    };
  });
}

/**
 * Clear game on screen
 */
function clearScreen(screenId) {
  delete activeGames[screenId];
}

/**
 * Clear entire queue - used when display reconnects
 */
function clearQueue(screenId) {
  if (screenId) {
    console.log(`🗑️ Clearing queue for ${screenId}`);
    screenQueues[screenId] = [];
  } else {
    console.log(`🗑️ Clearing ALL queues`);
    for (const id of SCREEN_IDS) {
      screenQueues[id] = [];
    }
  }
}

/**
 * Clear all games and queue - full reset
 */
function clearAllGames() {
  console.log(`🗑️ Clearing all games and queues`);

  // Clear all active games
  for (const screenId in activeGames) {
    delete activeGames[screenId];
  }

  // Clear queues
  clearQueue();

  console.log(`   All games and queues cleared`);
}

/**
 * Create new game manually (helper)
 */
function createNewGame(screenId, player1Id, player2Id) {
  activeGames[screenId] = {
    player1Id,
    player2Id,
    winnerId: null,
    startedAt: Date.now(),
  };
  return activeGames[screenId];
}

export {
  // Queue management
  joinScreenQueue,
  removeFromAllQueues,
  removePlayer,
  getQueuePosition,
  getQueueLength,
  getQueuedPlayers,
  clearQueue,
  clearAllGames,

  // Pairing
  getNextPairForScreen,

  // Game management
  handleGameOver,
  getGameForScreen,
  getScreenForPlayer,
  isPlayerPlaying,
  clearScreen,
  createNewGame,

  // Display management
  setDisplaySocket,
  getDisplaySocket,
  getAllDisplaySockets,
  getAllScreenStatuses,

  // Constants
  SCREEN_IDS,
};
