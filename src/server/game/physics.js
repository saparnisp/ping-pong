import { PONG_CONFIG } from "../../config.js";

/**
 * Update ball position and handle collisions
 * @param {Object} gameState - Current game state
 * @returns {Object} - Update result with scoring/collision info
 */
export function updateBall(gameState) {
  const { ball, player1, player2 } = gameState;
  const {
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    BALL_RADIUS,
    PADDLE_WIDTH,
    PADDLE_HEIGHT,
    PADDLE_OFFSET,
    BALL_SPEED_INCREMENT,
    BALL_MAX_SPEED,
    BALL_MIN_ANGLE,
  } = PONG_CONFIG;

  // Move ball
  ball.x += ball.velocityX;
  ball.y += ball.velocityY;

  // Top and bottom wall collision
  if (ball.y - BALL_RADIUS <= 0 || ball.y + BALL_RADIUS >= CANVAS_HEIGHT) {
    ball.velocityY *= -1;
    ball.y = Math.max(
      BALL_RADIUS,
      Math.min(CANVAS_HEIGHT - BALL_RADIUS, ball.y)
    );
  }

  // Player 1 paddle collision (left side)
  if (
    ball.x - BALL_RADIUS <= PADDLE_OFFSET + PADDLE_WIDTH &&
    ball.x - BALL_RADIUS > PADDLE_OFFSET &&
    ball.y >= player1.paddleY &&
    ball.y <= player1.paddleY + PADDLE_HEIGHT &&
    ball.velocityX < 0
  ) {
    // Calculate hit position on paddle (0 to 1)
    const hitPosition = (ball.y - player1.paddleY) / PADDLE_HEIGHT;

    // Increase speed
    ball.speed = Math.min(ball.speed + BALL_SPEED_INCREMENT, BALL_MAX_SPEED);

    // Calculate angle based on hit position (center = 0, edges = ±1)
    const angle = (hitPosition - 0.5) * 2;

    // Apply angle with minimum threshold to prevent too horizontal
    ball.velocityX = Math.abs(ball.speed * Math.cos(angle * Math.PI / 3));
    ball.velocityY = ball.speed * Math.sin(angle * Math.PI / 3);

    // Ensure minimum angle
    if (Math.abs(ball.velocityY) < BALL_MIN_ANGLE) {
      ball.velocityY = ball.velocityY < 0 ? -BALL_MIN_ANGLE : BALL_MIN_ANGLE;
    }

    // Move ball away from paddle to prevent sticking
    ball.x = PADDLE_OFFSET + PADDLE_WIDTH + BALL_RADIUS;

    return { type: "paddle_hit", player: 1 };
  }

  // Player 2 paddle collision (right side)
  if (
    ball.x + BALL_RADIUS >= CANVAS_WIDTH - PADDLE_OFFSET - PADDLE_WIDTH &&
    ball.x + BALL_RADIUS < CANVAS_WIDTH - PADDLE_OFFSET &&
    ball.y >= player2.paddleY &&
    ball.y <= player2.paddleY + PADDLE_HEIGHT &&
    ball.velocityX > 0
  ) {
    // Calculate hit position on paddle (0 to 1)
    const hitPosition = (ball.y - player2.paddleY) / PADDLE_HEIGHT;

    // Increase speed
    ball.speed = Math.min(ball.speed + BALL_SPEED_INCREMENT, BALL_MAX_SPEED);

    // Calculate angle based on hit position
    const angle = (hitPosition - 0.5) * 2;

    // Apply angle (negative velocityX for left direction)
    ball.velocityX = -Math.abs(ball.speed * Math.cos(angle * Math.PI / 3));
    ball.velocityY = ball.speed * Math.sin(angle * Math.PI / 3);

    // Ensure minimum angle
    if (Math.abs(ball.velocityY) < BALL_MIN_ANGLE) {
      ball.velocityY = ball.velocityY < 0 ? -BALL_MIN_ANGLE : BALL_MIN_ANGLE;
    }

    // Move ball away from paddle
    ball.x = CANVAS_WIDTH - PADDLE_OFFSET - PADDLE_WIDTH - BALL_RADIUS;

    return { type: "paddle_hit", player: 2 };
  }

  // Left wall - Player 2 scores
  if (ball.x - BALL_RADIUS <= 0) {
    return { type: "score", scorer: 2 };
  }

  // Right wall - Player 1 scores
  if (ball.x + BALL_RADIUS >= CANVAS_WIDTH) {
    return { type: "score", scorer: 1 };
  }

  return { type: "normal" };
}

/**
 * Reset ball to center with serving player direction
 * @param {Object} ball - Ball object
 * @param {Number} servingPlayer - 1 or 2
 */
export function resetBall(ball, servingPlayer = 1) {
  const { CANVAS_WIDTH, CANVAS_HEIGHT, BALL_INITIAL_SPEED } = PONG_CONFIG;

  ball.x = CANVAS_WIDTH / 2;
  ball.y = CANVAS_HEIGHT / 2;
  ball.speed = BALL_INITIAL_SPEED;

  // Random angle between -45° and 45°
  const angle = (Math.random() - 0.5) * (Math.PI / 3);

  // Serve towards the player who was scored on (opposite of scorer)
  const direction = servingPlayer === 1 ? 1 : -1;

  ball.velocityX = direction * ball.speed * Math.cos(angle);
  ball.velocityY = ball.speed * Math.sin(angle);
}

/**
 * Move paddle up or down (legacy - for keyboard)
 * @param {Object} player - Player object
 * @param {String} direction - 'up', 'down', or 'stop'
 */
export function movePaddle(player, direction) {
  const { CANVAS_HEIGHT, PADDLE_HEIGHT, PADDLE_SPEED } = PONG_CONFIG;

  if (direction === "up") {
    player.paddleY = Math.max(0, player.paddleY - PADDLE_SPEED);
    player.paddleVelocity = -PADDLE_SPEED;
  } else if (direction === "down") {
    player.paddleY = Math.min(
      CANVAS_HEIGHT - PADDLE_HEIGHT,
      player.paddleY + PADDLE_SPEED
    );
    player.paddleVelocity = PADDLE_SPEED;
  } else if (direction === "stop") {
    player.paddleVelocity = 0;
  }
}

/**
 * Set paddle position directly (for touch/drag controls)
 * @param {Object} player - Player object
 * @param {Number} normalizedPosition - Position from 0 (top) to 1 (bottom)
 */
export function setPaddlePosition(player, normalizedPosition) {
  const { CANVAS_HEIGHT, PADDLE_HEIGHT } = PONG_CONFIG;

  // Clamp between 0 and 1
  const clamped = Math.max(0, Math.min(1, normalizedPosition));

  // Calculate paddle Y (accounting for paddle height)
  const maxY = CANVAS_HEIGHT - PADDLE_HEIGHT;
  player.paddleY = clamped * maxY;

  // Stop any velocity-based movement
  player.paddleVelocity = 0;
}

/**
 * Update paddle with continuous movement
 * @param {Object} player - Player object
 */
export function updatePaddle(player) {
  const { CANVAS_HEIGHT, PADDLE_HEIGHT, PADDLE_SPEED } = PONG_CONFIG;

  if (player.paddleVelocity !== 0) {
    player.paddleY += player.paddleVelocity;
    player.paddleY = Math.max(
      0,
      Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, player.paddleY)
    );
  }
}

/**
 * Check if game is over (someone reached WIN_SCORE)
 * @param {Object} gameState - Current game state
 * @returns {Object|null} - Winner info or null if game continues
 */
export function checkGameOver(gameState) {
  const { WIN_SCORE } = PONG_CONFIG;
  const { player1, player2 } = gameState;

  if (player1.score >= WIN_SCORE) {
    return {
      gameOver: true,
      winner: 1,
      winnerId: player1.id,
      winnerSocketId: player1.socketId,
      loserId: player2.id,
      loserSocketId: player2.socketId,
      finalScore: { player1: player1.score, player2: player2.score },
    };
  }

  if (player2.score >= WIN_SCORE) {
    return {
      gameOver: true,
      winner: 2,
      winnerId: player2.id,
      winnerSocketId: player2.socketId,
      loserId: player1.id,
      loserSocketId: player1.socketId,
      finalScore: { player1: player1.score, player2: player2.score },
    };
  }

  return null;
}
