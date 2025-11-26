/**
 * PLAYER SESSION MANAGER
 * Tracks players across main and screen namespaces
 * Critical for festival scenario with queue reconnections
 */

// Map: mainSocketId -> { screenSocketId, screenId, playerNumber }
const playerSessions = new Map();

// Map: screenSocketId -> mainSocketId (reverse lookup)
const screenToMain = new Map();

/**
 * Register player when they join screen namespace
 */
function registerPlayerSession(mainSocketId, screenSocketId, screenId, playerNumber) {
  console.log(`📝 Registering session: main=${mainSocketId} screen=${screenSocketId} on ${screenId} as P${playerNumber}`);

  playerSessions.set(mainSocketId, {
    screenSocketId,
    screenId,
    playerNumber,
    joinedAt: Date.now(),
  });

  screenToMain.set(screenSocketId, mainSocketId);
}

/**
 * Get main socket ID from screen socket ID
 */
function getMainSocketId(screenSocketId) {
  return screenToMain.get(screenSocketId);
}

/**
 * Get screen socket ID from main socket ID
 */
function getScreenSocketId(mainSocketId) {
  const session = playerSessions.get(mainSocketId);
  return session?.screenSocketId;
}

/**
 * Get full session info
 */
function getSession(mainSocketId) {
  return playerSessions.get(mainSocketId);
}

/**
 * Clear session when player disconnects from screen
 */
function clearScreenSession(screenSocketId) {
  const mainSocketId = screenToMain.get(screenSocketId);

  if (mainSocketId) {
    const session = playerSessions.get(mainSocketId);
    console.log(`🗑️ Clearing screen session: ${screenSocketId} (main: ${mainSocketId})`);

    // Keep main socket ID, just clear screen info
    if (session) {
      session.screenSocketId = null;
      session.screenId = null;
    }

    screenToMain.delete(screenSocketId);
  }
}

/**
 * Completely remove player (full disconnect)
 */
function removePlayer(mainSocketId) {
  const session = playerSessions.get(mainSocketId);

  if (session?.screenSocketId) {
    screenToMain.delete(session.screenSocketId);
  }

  playerSessions.delete(mainSocketId);
  console.log(`🗑️ Removed player completely: ${mainSocketId}`);
}

/**
 * Get all active sessions
 */
function getAllSessions() {
  return Array.from(playerSessions.entries()).map(([mainId, session]) => ({
    mainSocketId: mainId,
    ...session,
  }));
}

/**
 * Debug: print all sessions
 */
function debugSessions() {
  console.log("\n=== PLAYER SESSIONS ===");
  for (const [mainId, session] of playerSessions.entries()) {
    console.log(`Main: ${mainId}`);
    console.log(`  Screen: ${session.screenSocketId || 'N/A'}`);
    console.log(`  Location: ${session.screenId || 'queue'}`);
    console.log(`  Player: ${session.playerNumber || 'N/A'}`);
  }
  console.log("=======================\n");
}

export {
  registerPlayerSession,
  getMainSocketId,
  getScreenSocketId,
  getSession,
  clearScreenSession,
  removePlayer,
  getAllSessions,
  debugSessions,
};
