/**
 * PONG MOBILE CONTROLLER
 * Mobile phone interface for playing Pong
 */

import { GameControls } from "./controls.js";

let currentLanguage = "lt";
let socket = null;
let screenSocket = null;
let controls = null;
let playerNumber = null;
let screenId = null;
let gameState = null;
let PONG_CONFIG = null;

// UI Elements
let waitingScreen = null;
let gameElements = null;
let winnerScreen = null;
let loserScreen = null;

// Loser countdown
let loserCountdownTimer = null;
let loserCountdownValue = 10;

/**
 * Update UI texts based on language
 */
function updateTexts() {
  document.querySelectorAll("[data-lt]").forEach((element) => {
    element.textContent = element.getAttribute(`data-${currentLanguage}`);
  });
}

/**
 * Toggle language
 */
function toggleLanguage() {
  currentLanguage = currentLanguage === "lt" ? "en" : "lt";
  updateTexts();
  document.getElementById("language-switcher").textContent =
    currentLanguage === "lt" ? "EN" : "LT";
}

/**
 * Show waiting screen with queue info
 */
function showWaitingScreen() {
  if (waitingScreen) waitingScreen.style.display = "block";
  if (gameElements) gameElements.style.display = "none";
  if (winnerScreen) winnerScreen.style.display = "none";
  if (loserScreen) loserScreen.style.display = "none";
}

/**
 * Show game screen
 */
function showGameScreen() {
  if (waitingScreen) waitingScreen.style.display = "none";
  if (gameElements) gameElements.style.display = "flex";
  if (winnerScreen) winnerScreen.style.display = "none";
  if (loserScreen) loserScreen.style.display = "none";
}

/**
 * Show winner screen
 */
function showWinnerScreen(finalScore) {
  if (winnerScreen) {
    winnerScreen.style.display = "flex";

    const scoreText = `${finalScore.player1} - ${finalScore.player2}`;
    document.getElementById("winnerFinalScore").textContent = scoreText;
  }

  if (waitingScreen) waitingScreen.style.display = "none";
  if (gameElements) gameElements.style.display = "none";
  if (loserScreen) loserScreen.style.display = "none";
}

/**
 * Show loser screen with countdown
 */
function showLoserScreen(finalScore) {
  console.log("📺 showLoserScreen called with:", finalScore);
  console.log("  loserScreen element exists:", !!loserScreen);

  // Hide all other screens first
  if (waitingScreen) {
    waitingScreen.style.display = "none";
    console.log("  ✅ Hidden waiting screen");
  }
  if (gameElements) {
    gameElements.style.display = "none";
    console.log("  ✅ Hidden game elements");
  }
  if (winnerScreen) {
    winnerScreen.style.display = "none";
    console.log("  ✅ Hidden winner screen");
  }

  // Show loser screen
  if (loserScreen) {
    loserScreen.style.display = "flex";
    console.log("  ✅ Showing loser screen");

    const scoreText = `${finalScore.player1} - ${finalScore.player2}`;
    const scoreElement = document.getElementById("loserFinalScore");
    if (scoreElement) {
      scoreElement.textContent = scoreText;
      console.log("  ✅ Updated score:", scoreText);
    }

    // Start 10 second countdown
    console.log("  🎬 Starting countdown...");
    startLoserCountdown();
  } else {
    console.error("  ❌ ERROR: loserScreen element not found!");
  }
}

/**
 * Start countdown for loser
 */
function startLoserCountdown() {
  console.log("⏱️ startLoserCountdown called");

  loserCountdownValue = 10;
  const timerElement = document.getElementById("countdownTimer");

  console.log("  Timer element:", timerElement);
  console.log("  Starting from:", loserCountdownValue);

  if (timerElement) {
    timerElement.textContent = loserCountdownValue;
    console.log("  ✅ Set initial timer value");
  } else {
    console.error("  ❌ ERROR: countdownTimer element not found!");
    return;
  }

  // Clear any existing timer
  if (loserCountdownTimer) {
    console.log("  Clearing existing timer");
    clearInterval(loserCountdownTimer);
  }

  loserCountdownTimer = setInterval(() => {
    loserCountdownValue--;
    console.log(`  ⏰ Countdown: ${loserCountdownValue}`);

    if (timerElement) {
      timerElement.textContent = loserCountdownValue;
    }

    if (loserCountdownValue <= 0) {
      clearInterval(loserCountdownTimer);
      loserCountdownTimer = null;

      // Time's up - redirect to landing
      console.log("⏰ Countdown expired, redirecting to landing");
      window.location.href = "/";
    }
  }, 1000);

  console.log("  ✅ Countdown timer started");
}

/**
 * Stop countdown (when play button pressed)
 */
function stopLoserCountdown() {
  if (loserCountdownTimer) {
    clearInterval(loserCountdownTimer);
    loserCountdownTimer = null;
  }
}

/**
 * Handle play button click
 */
function handlePlayButtonClick() {
  console.log("✅ Play button clicked - staying in queue");

  // Stop countdown
  stopLoserCountdown();

  // Disconnect from screen namespace NOW
  if (screenSocket) {
    console.log("🔄 Disconnecting from screen namespace (user clicked PLAY)...");
    screenSocket.disconnect();
    screenSocket = null;
  }

  // Clear screen-related state
  controls = null;
  screenId = null;
  playerNumber = null;

  console.log("  ✅ Disconnected, returning to main namespace queue");

  // Notify server that loser wants to stay in queue
  if (socket) {
    socket.emit("loserReady");
  }

  // Show waiting screen
  showWaitingScreen();

  // Update texts
  updateTexts();
}

/**
 * Update queue display
 */
function updateQueueDisplay(position, queueLength) {
  const queueCountEl = document.getElementById("queue-count");
  const queuePositionEl = document.getElementById("queue-position");

  if (queueCountEl) {
    queueCountEl.textContent = queueLength || 0;
  }

  if (queuePositionEl) {
    if (position) {
      queuePositionEl.textContent = position;
    } else {
      queuePositionEl.textContent = currentLanguage === "lt" ? "Laukiama..." : "Waiting...";
    }
  }
}

/**
 * Apply player color theme based on player number
 */
function applyPlayerColors() {
  const paddleElement = document.getElementById("draggable-paddle");
  const yourScoreItem = document.getElementById("yourScoreItem");
  const opponentScoreItem = document.getElementById("opponentScoreItem");

  if (!paddleElement || !playerNumber) return;

  // Remove existing player classes
  paddleElement.classList.remove("player1", "player2");
  yourScoreItem?.classList.remove("player1", "player2");

  // Add player class based on number
  if (playerNumber === 1) {
    paddleElement.classList.add("player1"); // Cyan
    yourScoreItem?.classList.add("player1");
    opponentScoreItem?.classList.add("player2");
    console.log("🎨 Applied Player 1 theme (Cyan)");
  } else {
    paddleElement.classList.add("player2"); // Magenta
    yourScoreItem?.classList.add("player2");
    opponentScoreItem?.classList.add("player1");
    console.log("🎨 Applied Player 2 theme (Magenta)");
  }
}

/**
 * Update score display
 */
function updateScoreDisplay() {
  if (!gameState) return;

  const yourScoreEl = document.getElementById("yourScore");
  const opponentScoreEl = document.getElementById("opponentScore");

  if (yourScoreEl && opponentScoreEl) {
    if (playerNumber === 1) {
      yourScoreEl.textContent = gameState.player1?.score || 0;
      opponentScoreEl.textContent = gameState.player2?.score || 0;
    } else {
      yourScoreEl.textContent = gameState.player2?.score || 0;
      opponentScoreEl.textContent = gameState.player1?.score || 0;
    }
  }
}

/**
 * Connect to main server and join queue
 */
function connectToServer() {
  socket = io("/", {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
  });

  socket.on("connect", () => {
    console.log("Connected to server:", socket.id);
    socket.emit("playerConnect");
  });

  socket.on("queueUpdate", (data) => {
    console.log("Queue update:", data);
    updateQueueDisplay(data.position, data.queueLength);
  });

  socket.on("matchFound", (data) => {
    console.log("Match found:", data);
    screenId = data.screenId;
    playerNumber = data.playerNumber;

    document.getElementById("screen-id").textContent = screenId.split("_")[1] || screenId;
    document.getElementById("screen").textContent = screenId.split("_")[1] || screenId;

    // Connect to screen namespace
    connectToScreen(screenId);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from server");
  });
}

/**
 * Connect to screen-specific namespace
 */
function connectToScreen(screenId) {
  screenSocket = io(`/${screenId}`, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
  });

  screenSocket.on("connect", () => {
    console.log("📱 Connected to screen:", screenId);
    console.log("  Main socket ID:", socket.id);
    console.log("  Screen socket ID:", screenSocket.id);
    console.log("  Player number:", playerNumber);

    // Identify as player and request game config
    // Send main namespace socket ID so server can update the mapping
    screenSocket.emit("playerReady", {
      mainSocketId: socket.id,
      playerNumber: playerNumber
    });
  });

  screenSocket.on("gameConfig", (config) => {
    console.log("Game config received:", config);
    PONG_CONFIG = config;

    // Apply player color theme
    applyPlayerColors();

    // Setup controls - always reinitialize
    if (!controls) {
      console.log("Initializing controls...");
      controls = new GameControls(screenSocket);
      controls.setupControlEvents();
      console.log("Controls initialized and ready");
    } else {
      console.log("Updating controls socket...");
      controls.setSocket(screenSocket);
    }
  });

  screenSocket.on("countdownStart", () => {
    console.log("Countdown starting...");
    showWaitingScreen();
  });

  screenSocket.on("gameStart", () => {
    console.log("Game started!");
    showGameScreen();

    // Make sure controls are active
    if (controls) {
      console.log("Activating controls...");
      controls.setPlaying(true);
      console.log("Controls active, can play now!");
    } else {
      console.error("Controls not initialized yet!");
      // Initialize controls if not done yet
      controls = new GameControls(screenSocket);
      controls.setupControlEvents();
      controls.setPlaying(true);
    }
  });

  screenSocket.on("updateGame", (newGameState) => {
    gameState = newGameState;
    updateScoreDisplay();
  });

  screenSocket.on("scored", (data) => {
    console.log("Score:", data);
  });

  screenSocket.on("gameEnd", (data) => {
    console.log(data.won ? "🎉 YOU WON!" : "😢 YOU LOST");
    console.log("Final score:", data.finalScore);
    console.log("Full gameEnd data:", data);

    if (controls) {
      controls.setPlaying(false);
    }

    if (data.won) {
      // Winner - show winner screen and wait
      console.log("🏆 Showing winner screen...");
      showWinnerScreen(data.finalScore);
      console.log("🏆 Winner waiting for next opponent...");
    } else {
      // Loser - show loser screen with countdown
      console.log("😢 Showing loser screen...");
      console.log("  loserScreen element:", loserScreen);

      showLoserScreen(data.finalScore);

      console.log("  ✅ Loser screen displayed");
      console.log("  ⏱️ Countdown running");
      console.log("  ℹ️ Screen namespace stays connected until user action");

      // Note: Disconnect will happen when:
      // 1. User clicks PLAY button (handlePlayButtonClick)
      // 2. Countdown expires and redirects to landing
      // This ensures loser screen is ALWAYS visible with no race condition
    }
  });

  screenSocket.on("newOpponent", (data) => {
    console.log("🆚 New opponent:", data);
    showWaitingScreen();

    // Re-apply player colors for new match
    applyPlayerColors();

    // Re-identify ourselves to update socket mapping for new match
    console.log("🔄 Re-emitting playerReady for new match...");
    screenSocket.emit("playerReady", {
      mainSocketId: socket.id,
      playerNumber: playerNumber
    });
  });

  screenSocket.on("waitingForChallenger", () => {
    console.log("⏳ Waiting for challenger...");
    showWaitingScreen();
    if (controls) {
      controls.setPlaying(false);
    }

    // Re-identify ourselves to maintain socket mapping while waiting
    console.log("🔄 Re-emitting playerReady while waiting...");
    screenSocket.emit("playerReady", {
      mainSocketId: socket.id,
      playerNumber: playerNumber
    });
  });

  screenSocket.on("disconnect", () => {
    console.log("Disconnected from screen");
  });
}

/**
 * Initialize
 */
document.addEventListener("DOMContentLoaded", () => {
  // Get UI elements
  waitingScreen = document.getElementById("waiting-screen");
  gameElements = document.querySelector(".game-elements");
  winnerScreen = document.getElementById("winnerScreen");
  loserScreen = document.getElementById("loserScreen");

  // Language switcher
  document
    .getElementById("language-switcher")
    .addEventListener("click", toggleLanguage);

  // Play button for loser
  document.getElementById("playButton")?.addEventListener("click", handlePlayButtonClick);

  updateTexts();
  showWaitingScreen();

  // Connect to server
  connectToServer();

  // Prevent context menu
  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    return false;
  });
});
