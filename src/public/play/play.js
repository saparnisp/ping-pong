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
let confirmationScreen = null;

let gameEndReceived = false; // Track if gameEnd event was received

// Confirmation countdown
let confirmCountdownTimer = null;
let confirmCountdownValue = 10;
let loserCountdownTimer = null;
let loserCountdownValue = 5;

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
  if (confirmationScreen) confirmationScreen.style.display = "none";
}

/**
 * Show confirmation screen
 */
function showConfirmationScreen() {
  console.log("📋 Showing confirmation screen");

  if (confirmationScreen) confirmationScreen.style.display = "flex";
  if (waitingScreen) waitingScreen.style.display = "none";
  if (gameElements) gameElements.style.display = "none";
  if (winnerScreen) winnerScreen.style.display = "none";
  if (loserScreen) loserScreen.style.display = "none";

  // Start confirmation countdown
  startConfirmationCountdown();
}

/**
 * Show game screen
 */
function showGameScreen() {
  if (waitingScreen) waitingScreen.style.display = "none";
  if (gameElements) gameElements.style.display = "flex";
  if (winnerScreen) winnerScreen.style.display = "none";
  if (loserScreen) loserScreen.style.display = "none";
  if (confirmationScreen) confirmationScreen.style.display = "none";
}

/**
 * Start confirmation countdown (10s to confirm ready)
 */
function startConfirmationCountdown() {
  console.log("⏱️ Starting confirmation countdown");

  confirmCountdownValue = 10;
  const timerElement = document.getElementById("confirmCountdownTimer");

  if (timerElement) {
    timerElement.textContent = confirmCountdownValue;
  }

  // Clear any existing timer
  if (confirmCountdownTimer) {
    clearInterval(confirmCountdownTimer);
  }

  confirmCountdownTimer = setInterval(() => {
    confirmCountdownValue--;
    console.log(`  ⏰ Confirmation countdown: ${confirmCountdownValue}`);

    if (timerElement) {
      timerElement.textContent = confirmCountdownValue;
    }

    if (confirmCountdownValue <= 0) {
      clearInterval(confirmCountdownTimer);
      confirmCountdownTimer = null;

      // Time's up - return to landing
      console.log("⏰ Confirmation expired, redirecting to landing");
      window.location.href = "/";
    }
  }, 1000);
}

/**
 * Stop confirmation countdown
 */
function stopConfirmationCountdown() {
  if (confirmCountdownTimer) {
    clearInterval(confirmCountdownTimer);
    confirmCountdownTimer = null;
  }
}

/**
 * Start loser countdown (5s to redirect)
 */
function startLoserCountdown() {
  console.log("⏱️ Starting loser countdown");

  loserCountdownValue = 5;
  const timerElement = document.getElementById("loserCountdownTimer");

  if (timerElement) {
    timerElement.textContent = loserCountdownValue;
  }

  // Clear any existing timer
  if (loserCountdownTimer) {
    clearInterval(loserCountdownTimer);
  }

  loserCountdownTimer = setInterval(() => {
    loserCountdownValue--;
    console.log(`  ⏰ Loser countdown: ${loserCountdownValue}`);

    if (timerElement) {
      timerElement.textContent = loserCountdownValue;
    }

    if (loserCountdownValue <= 0) {
      clearInterval(loserCountdownTimer);
      loserCountdownTimer = null;

      // Time's up - redirect to landing
      console.log("⏰ Loser countdown expired, redirecting to landing");
      window.location.href = "/";
    }
  }, 1000);
}

/**
 * Stop loser countdown
 */
function stopLoserCountdown() {
  if (loserCountdownTimer) {
    clearInterval(loserCountdownTimer);
    loserCountdownTimer = null;
  }
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

    if (screenSocket) {
      screenSocket.disconnect();
      screenSocket = null;
    }
    if (socket) {
      socket.disconnect();
      // Don't set socket to null here as handlePlayButtonClick might check it, 
      // but connection is closed.
    }

    // Start countdown to auto-redirect
    startLoserCountdown();
  } else {
    console.error("  ❌ ERROR: loserScreen element not found!");
  }
}

/**
 * Handle confirmation ready button click
 */
function handleConfirmReadyClick() {
  console.log("✅ Confirmation READY clicked");

  // Stop confirmation countdown
  stopConfirmationCountdown();

  // Emit confirmation to server
  // If we're in rematch (winner), use screenSocket; otherwise use main socket
  if (screenSocket && screenSocket.connected) {
    // Winner in rematch - send via screen namespace
    console.log("📤 Sending playerConfirmed via screen namespace (rematch)");
    screenSocket.emit("playerConfirmed");
  } else if (socket) {
    // Challenger or new match - send via main namespace
    console.log("📤 Sending playerConfirmed via main namespace");
    socket.emit("playerConfirmed");
  }

  // Show waiting screen (wait for both players to confirm)
  showWaitingScreen();

  const waitingMessage = document.getElementById("queue-position");
  if (waitingMessage) {
    waitingMessage.textContent = currentLanguage === "lt" ? "Laukiama kito žaidėjo..." : "Waiting for other player...";
  }
}

/**
 * Handle play button click
 */
function handlePlayButtonClick() {
  console.log("✅ Play button clicked - redirecting to main page");

  stopLoserCountdown();

  // Disconnect from screen namespace
  if (screenSocket) {
    console.log("🔄 Disconnecting from screen namespace...");
    screenSocket.disconnect();
    screenSocket = null;
  }

  // Disconnect main socket
  if (socket) {
    socket.disconnect();
  }

  // Redirect to home page
  window.location.href = "/";
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

    // Get screen ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const targetScreenId = urlParams.get("screen");

    if (targetScreenId) {
      console.log(`Joining screen queue: ${targetScreenId}`);
      socket.emit("joinScreen", { screenId: targetScreenId });
    } else {
      console.error("No screen specified in URL!");
      alert("Nepasirinktas ekranas! Grįžkite į pagrindinį puslapį.");
      window.location.href = "/";
    }
  });

  socket.on("queueUpdate", (data) => {
    console.log("Queue update:", data);
    updateQueueDisplay(data.position, data.queueLength);
  });

  socket.on("matchFound", (data) => {
    console.log("Match found:", data);
    screenId = data.screenId;
    playerNumber = data.playerNumber;

    // Update screen number in confirmation screen
    document.getElementById("confirmScreenNumber").textContent = screenId.split("_")[1] || screenId;

    // Show confirmation screen
    showConfirmationScreen();

    // Update texts
    updateTexts();
  });

  socket.on("bothPlayersReady", (data) => {
    console.log("✅ Both players confirmed! Connecting to screen:", data.screenId);

    // Stop confirmation countdown
    stopConfirmationCountdown();

    // Update screen info
    document.getElementById("screen-id").textContent = screenId.split("_")[1] || screenId;
    document.getElementById("screen").textContent = screenId.split("_")[1] || screenId;

    // Connect to screen namespace
    connectToScreen(screenId);
  });

  socket.on("matchCancelled", (data) => {
    console.log("❌ Match cancelled:", data.reason);

    // Stop confirmation countdown
    stopConfirmationCountdown();

    // Return to waiting screen
    showWaitingScreen();

    alert(data.reason);
  });

  socket.on("queueReset", (data) => {
    console.log("🔄 Queue reset:", data.message);

    // Reset queue display
    updateQueueDisplay(null, 0);

    // Show waiting screen
    showWaitingScreen();

    // Alert user
    alert(data.message);
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
    gameEndReceived = false; // Reset game end flag for new game
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
    const previousGameActive = gameState?.gameActive;
    gameState = newGameState;
    updateScoreDisplay();

    // Fallback: If game was active and suddenly stopped, check if someone won
    // This handles cases where gameEnd event might not be received
    if (previousGameActive && !newGameState.gameActive && !gameEndReceived) {
      // Check if loser/winner screens are already showing
      const loserShowing = loserScreen && loserScreen.style.display === "flex";
      const winnerShowing = winnerScreen && winnerScreen.style.display === "flex";

      if (!loserShowing && !winnerShowing) {
        // Check if someone reached WIN_SCORE
        const WIN_SCORE = 5; // From PONG_CONFIG
        if (newGameState.player1 && newGameState.player2) {
          const player1Won = newGameState.player1.score >= WIN_SCORE;
          const player2Won = newGameState.player2.score >= WIN_SCORE;

          if (player1Won || player2Won) {
            console.log("⚠️ Game stopped without gameEnd event, but winner found!");
            const isWinner = (playerNumber === 1 && player1Won) || (playerNumber === 2 && player2Won);
            const finalScore = {
              player1: newGameState.player1.score,
              player2: newGameState.player2.score
            };

            console.log(`🎮 Game over detected via fallback: Winner=${isWinner ? 'YOU' : 'OPPONENT'}`);
            gameEndReceived = true; // Mark as received to prevent duplicate handling

            if (controls) {
              controls.setPlaying(false);
            }

            if (isWinner) {
              showWinnerScreen(finalScore);
            } else {
              showLoserScreen(finalScore);
            }
          }
        }
      }
    }
  });

  screenSocket.on("scored", (data) => {
    console.log("Score:", data);
  });

  screenSocket.on("gameEnd", (data) => {
    console.log(data.won ? "🎉 YOU WON!" : "😢 YOU LOST");
    console.log("Final score:", data.finalScore);
    console.log("Full gameEnd data:", data);

    gameEndReceived = true; // Mark that gameEnd was received

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

  // Handle matchFound for rematch (winner receives this on screen namespace)
  screenSocket.on("matchFound", (data) => {
    console.log("🆚 Match found (rematch) on screen namespace:", data);
    screenId = data.screenId;
    playerNumber = data.playerNumber;

    // Update screen number in confirmation screen
    document.getElementById("confirmScreenNumber").textContent = screenId.split("_")[1] || screenId;

    // Show confirmation screen
    showConfirmationScreen();

    // Update texts
    updateTexts();
  });

  // Handle bothPlayersReady for rematch (winner receives this on screen namespace)
  screenSocket.on("bothPlayersReady", (data) => {
    console.log("✅ Both players confirmed (rematch)! Screen:", data.screenId);

    // Stop confirmation countdown if running
    stopConfirmationCountdown();

    // Update screen info
    document.getElementById("screen-id").textContent = screenId.split("_")[1] || screenId;
    document.getElementById("screen").textContent = screenId.split("_")[1] || screenId;

    // Winner is already connected to screen namespace, just need to wait for countdown
    // The game will start automatically via countdown
  });

  // Handle matchCancelled for rematch (winner receives this on screen namespace)
  screenSocket.on("matchCancelled", (data) => {
    console.log("❌ Match cancelled (rematch):", data.reason);

    // Stop confirmation countdown
    stopConfirmationCountdown();

    // Return to waiting screen
    showWaitingScreen();

    alert(data.reason);
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
  confirmationScreen = document.getElementById("confirmationScreen");

  // Language switcher
  document
    .getElementById("language-switcher")
    .addEventListener("click", toggleLanguage);

  // Confirmation ready button
  document.getElementById("confirmReadyButton")?.addEventListener("click", handleConfirmReadyClick);

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
