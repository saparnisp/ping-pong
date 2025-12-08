/**
 * PONG DISPLAY - Big Screen Rendering
 * Displays the Pong game on large public screens
 */

let PONG_CONFIG = null;
let screenId = null;
let canvas = null;
let ctx = null;
let socket = null;
let gameState = null;
let showScreenNumber = true;
let glowIntensity = 0;
let glowDirection = 1;
let gameOverWinner = null; // Track game over state

/**
 * Get screen ID from URL
 */
const getScreenId = () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  // If id is just a number (1, 2, 3), prefix with "display_"
  if (id && /^\d+$/.test(id)) {
    return `display_${id}`;
  }

  // Otherwise use as-is, or default to display_1
  return id || "display_1";
};

/**
 * Initialize canvas
 */
function initCanvas() {
  canvas = document.getElementById("gameCanvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "gameCanvas";
    document.body.appendChild(canvas);
  }

  ctx = canvas.getContext("2d");

  // Set canvas to full screen
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
}

/**
 * Resize canvas to fill screen
 */
function resizeCanvas() {
  if (!PONG_CONFIG) return;

  // Maintain aspect ratio
  const aspectRatio = PONG_CONFIG.CANVAS_WIDTH / PONG_CONFIG.CANVAS_HEIGHT;
  const windowAspectRatio = window.innerWidth / window.innerHeight;

  if (windowAspectRatio > aspectRatio) {
    // Window is wider
    canvas.height = window.innerHeight;
    canvas.width = canvas.height * aspectRatio;
  } else {
    // Window is taller
    canvas.width = window.innerWidth;
    canvas.height = canvas.width / aspectRatio;
  }

  // Center canvas
  canvas.style.position = "absolute";
  canvas.style.left = `${(window.innerWidth - canvas.width) / 2}px`;
  canvas.style.top = `${(window.innerHeight - canvas.height) / 2}px`;
}

/**
 * Scale coordinate from game space to canvas space
 */
function scaleX(x) {
  if (!PONG_CONFIG) return x;
  return (x / PONG_CONFIG.CANVAS_WIDTH) * canvas.width;
}

function scaleY(y) {
  if (!PONG_CONFIG) return y;
  return (y / PONG_CONFIG.CANVAS_HEIGHT) * canvas.height;
}

function scaleSize(size) {
  if (!PONG_CONFIG) return size;
  // Use the smaller scale factor to maintain aspect ratio
  const scaleX = canvas.width / PONG_CONFIG.CANVAS_WIDTH;
  const scaleY = canvas.height / PONG_CONFIG.CANVAS_HEIGHT;
  const scale = Math.min(scaleX, scaleY);
  return size * scale;
}

/**
 * Draw screen number when idle
 */
function drawScreenNumber() {
  if (!showScreenNumber || !PONG_CONFIG) return;

  ctx.save();
  ctx.font = `bold ${scaleSize(200)}px monospace`;
  ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + glowIntensity * 0.1})`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const number = screenId.split("_")[1] || "1";
  ctx.fillText(number, canvas.width / 2, canvas.height / 2);

  ctx.restore();

  // Animate glow
  glowIntensity += glowDirection * 0.02;
  if (glowIntensity >= 1 || glowIntensity <= 0) {
    glowDirection *= -1;
  }
}

/**
 * Draw net/center line
 */
function drawNet() {
  ctx.save();
  ctx.strokeStyle = PONG_CONFIG.NET_COLOR;
  ctx.lineWidth = scaleSize(2);
  ctx.setLineDash([scaleSize(10), scaleSize(15)]);

  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw paddle
 */
function drawPaddle(x, y, color) {
  const paddleWidth = scaleSize(PONG_CONFIG.PADDLE_WIDTH);
  const paddleHeight = scaleSize(PONG_CONFIG.PADDLE_HEIGHT);

  ctx.save();

  // Glow effect
  ctx.shadowBlur = scaleSize(PONG_CONFIG.PADDLE_GLOW);
  ctx.shadowColor = color;

  // Paddle body
  ctx.fillStyle = color;
  ctx.fillRect(
    scaleX(x),
    scaleY(y),
    paddleWidth,
    paddleHeight
  );

  ctx.restore();
}

/**
 * Draw ball
 */
function drawBall(x, y) {
  const radius = scaleSize(PONG_CONFIG.BALL_RADIUS);

  ctx.save();

  // Glow effect
  ctx.shadowBlur = scaleSize(PONG_CONFIG.BALL_GLOW);
  ctx.shadowColor = PONG_CONFIG.BALL_COLOR;

  // Ball
  ctx.fillStyle = PONG_CONFIG.BALL_COLOR;
  ctx.beginPath();
  ctx.arc(scaleX(x), scaleY(y), radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draw score
 */
function drawScores(score1, score2) {
  ctx.save();
  ctx.font = `bold ${scaleSize(80)}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  // Player 1 score (left, cyan)
  ctx.fillStyle = PONG_CONFIG.PLAYER1_COLOR;
  ctx.shadowBlur = scaleSize(10);
  ctx.shadowColor = PONG_CONFIG.PLAYER1_COLOR;
  ctx.fillText(score1, canvas.width / 4, scaleY(40));

  // Player 2 score (right, magenta)
  ctx.fillStyle = PONG_CONFIG.PLAYER2_COLOR;
  ctx.shadowColor = PONG_CONFIG.PLAYER2_COLOR;
  ctx.fillText(score2, (3 * canvas.width) / 4, scaleY(40));

  ctx.restore();
}

/**
 * Draw countdown number
 */
function drawCountdown(number) {
  ctx.save();
  ctx.font = `bold ${scaleSize(200)}px monospace`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
  ctx.lineWidth = scaleSize(3);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.strokeText(number, canvas.width / 2, canvas.height / 2);
  ctx.fillText(number, canvas.width / 2, canvas.height / 2);

  ctx.restore();
}

/**
 * Draw game over message
 */
function drawGameOver(winner) {
  ctx.save();
  ctx.font = `bold ${scaleSize(60)}px monospace`;
  ctx.fillStyle = winner === 1 ? PONG_CONFIG.PLAYER1_COLOR : PONG_CONFIG.PLAYER2_COLOR;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowBlur = scaleSize(20);
  ctx.shadowColor = ctx.fillStyle;

  ctx.fillText(
    `PLAYER ${winner} WINS!`,
    canvas.width / 2,
    canvas.height / 2 - scaleY(50)
  );

  ctx.font = `${scaleSize(30)}px monospace`;
  ctx.fillStyle = "#FFF";
  ctx.shadowBlur = 0;
  ctx.fillText(
    "Laukiamas naujas priešininkas...",
    canvas.width / 2,
    canvas.height / 2 + scaleY(50)
  );

  ctx.restore();
}

/**
 * Main render function
 */
function render() {
  if (!canvas || !ctx) {
    requestAnimationFrame(render);
    return;
  }

  // Loading screen - waiting for config
  if (!PONG_CONFIG) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "30px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Connecting...", canvas.width / 2, canvas.height / 2);
    requestAnimationFrame(render);
    return;
  }

  // Idle screen - no game state
  if (!gameState) {
    ctx.fillStyle = PONG_CONFIG.BACKGROUND_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawScreenNumber();
    requestAnimationFrame(render);
    return;
  }

  // Clear canvas
  ctx.fillStyle = PONG_CONFIG.BACKGROUND_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw net
  drawNet();

  // Draw scores
  if (gameState.player1 && gameState.player2) {
    drawScores(gameState.player1.score, gameState.player2.score);
  }

  // Draw paddles
  if (gameState.player1) {
    drawPaddle(
      PONG_CONFIG.PADDLE_OFFSET,
      gameState.player1.paddleY,
      PONG_CONFIG.PLAYER1_COLOR
    );
  }

  if (gameState.player2) {
    // Right paddle position: from right edge, accounting for paddle width
    const rightPaddleX = PONG_CONFIG.CANVAS_WIDTH - PONG_CONFIG.PADDLE_OFFSET - PONG_CONFIG.PADDLE_WIDTH;
    drawPaddle(
      rightPaddleX,
      gameState.player2.paddleY,
      PONG_CONFIG.PLAYER2_COLOR
    );
  }

  // Draw ball
  if (gameState.ball) {
    drawBall(gameState.ball.x, gameState.ball.y);
  }

  // Draw game over message if game ended
  if (gameOverWinner) {
    drawGameOver(gameOverWinner);
  } else if (!gameState.gameActive) {
    // Draw screen number when no active game (but not during game over)
    drawScreenNumber();
  }

  // Request next frame
  requestAnimationFrame(render);
}

/**
 * Handle game state update
 */
function handleUpdateGame(newGameState) {
  gameState = newGameState;

  if (gameState.gameActive) {
    showScreenNumber = false;
    gameOverWinner = null; // Clear game over when game becomes active
  }
}

/**
 * Handle game over event
 */
function handleGameOver(data) {
  console.log("Game over received:", data);
  // data.winner is 1 or 2
  gameOverWinner = data.winner;
  showScreenNumber = false;
}

/**
 * Handle countdown
 */
let countdownNumber = null;

function handleCountdownStart(data) {
  countdownNumber = data.countdown || 3;
  showScreenNumber = false;
}

function handleCountdown(data) {
  countdownNumber = data.countdown;

  // Draw countdown immediately
  ctx.fillStyle = PONG_CONFIG.BACKGROUND_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawNet();
  drawCountdown(countdownNumber);
}

function handleGameStart() {
  countdownNumber = null;
  showScreenNumber = false;
  gameOverWinner = null; // Clear game over when new game starts
}

/**
 * Handle scored event
 */
function handleScored(data) {
  console.log(`Score! Player ${data.scorer} scored`);
}

/**
 * Connect to socket
 */
function connectSocket() {
  // Connect to screen-specific namespace
  const namespace = `/${screenId}`;
  console.log("Connecting to namespace:", namespace);

  socket = io(namespace, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
  });

  socket.on("connect", () => {
    console.log("Display connected:", socket.id, "to", namespace);
    socket.emit("displayConnect");
  });

  socket.on("gameConfig", (config) => {
    console.log("Received game config:", config);
    PONG_CONFIG = config;

    // Resize canvas now that we have config
    resizeCanvas();

    // Initialize empty game state if needed
    if (!gameState) {
      gameState = {
        player1: null,
        player2: null,
        ball: null,
        gameActive: false
      };
    }

    console.log("Display ready to render");
  });

  socket.on("updateGame", handleUpdateGame);
  socket.on("countdownStart", handleCountdownStart);
  socket.on("countdown", handleCountdown);
  socket.on("gameStart", handleGameStart);
  socket.on("scored", handleScored);
  socket.on("gameOver", handleGameOver);

  socket.on("enableBlinking", () => {
    console.log("Player disconnected, blinking...");
    // TODO: Add blinking effect
  });

  socket.on("disableBlinking", () => {
    console.log("Player reconnected");
  });

  socket.on("disconnect", () => {
    console.log("Display disconnected");
  });
}

/**
 * Initialize
 */
document.addEventListener("DOMContentLoaded", () => {
  screenId = getScreenId();
  console.log("Display screen ID:", screenId);

  initCanvas();
  connectSocket();

  // Start render loop
  requestAnimationFrame(render);

  // Keyboard shortcuts for testing
  document.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "f":
      case "F":
        // Toggle fullscreen
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
        break;
    }
  });
});
