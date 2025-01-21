import { getCurrentGame, recordGameMove, resetGame } from "../game/state.js";
import { createPiece } from "../game/pieces.js";
import { dropPiece, moveLeft, moveRight, rotate } from "../game/mechanics.js";
import { addScore } from "../game/scores.js";
import {
  addToQueue,
  removePlayer,
  getNextPlayer,
  setDisplaySocket,
  getDisplaySocket,
  getCurrentPlayer,
  clearCurrentPlayer,
  getAllQueueStatuses,
  getAllQueues,
} from "../game/queue.js";
import {
  startReplay,
  clearReplayTimers,
  scheduleReplay,
} from "../game/replay.js";
import {
  COLORS,
  RECONNECT_WAIT,
  SCREEN_SIZE,
  DEFAULT_BLOCK_SIZE,
} from "../../config.js";
import { createDigit } from "../game/digits.js";

let dropInterval = {};
let reconnectInterval = {};
// TODO: Use it!
let countDownInterval = {};

let io = null;

function clearDropInterval(id, force) {
  if (dropInterval[id]) {
    clearInterval(dropInterval[id]);
    dropInterval[id] = null;
  }
  if (force) {
    Object.keys(dropInterval).forEach((key) => {
      if (dropInterval[key]) {
        clearInterval(dropInterval[key]);
        dropInterval[key] = null;
      }
    });
  }
}

function startNewGame(socket, id) {
  console.log("Starting new game for display:", id);
  const nsp = io.of(`/display_${id}`);

  const currentGame = getCurrentGame(id);
  currentGame.currentPiece = createPiece();
  currentGame.nextPiece = createPiece();

  clearDropInterval(id);

  // Initial game state update
  //   console.log("Sending initial game state:", currentGame);
  nsp.emit("updateGame", currentGame);

  // Start drop interval
  dropInterval[id] = setInterval(() => {
    const result = dropPiece(id);
    if (result) {
      recordGameMove(id);
      if (result.gameOver) {
        handleGameOver(socket, id, result);
      } else {
        nsp.emit("updateGame", currentGame);
        if (result.levelUp) {
          nsp.to(getCurrentPlayer(id)).emit("levelUp", {
            level: currentGame.level,
            speed: currentGame.dropSpeed,
          });
        }
      }
    }
  }, currentGame.dropSpeed);
}

async function handleGameOver(socket, id, result) {
  // console.log("GAME OVER!");
  const currentPlayerId = getCurrentPlayer(id);
  const currentGame = getCurrentGame(id);
  const nsp = io.of(`/display_${id}`);

  if (currentPlayerId) {
    nsp.to(currentPlayerId).emit("gameEnd", {
      score: result.finalScore,
      level: result.finalLevel,
      lines: result.finalLines,
    });

    try {
      await addScore({
        points: result.finalScore,
        lines: result.finalLines,
        timestamp: new Date().toISOString(),
      });

      clearCurrentPlayer(id);
      clearDropInterval(id);
      nsp.emit("updateGame", currentGame);

      // Start game for next player in queue
      const nextPlayer = getNextPlayer(id);
      if (nextPlayer) {
        nsp.to(nextPlayer).emit("countdownStart");
        startCountdown(socket, id);
      } else if (getDisplaySocket(id)) {
        scheduleReplay(id);
      }
    } catch (error) {
      console.error("Error handling game over:", error);
    }
  }
}

function handleDisplayConnect(socket) {
  const id = socket.nsp.name.split("_")[1];
  const nsp = io.of(`/display_${id}`);

  console.log("Display connected:", socket.id, "display:", id);
  setDisplaySocket(id, socket);
  nsp
    .to(socket.id)
    .emit("gameConfig", { SCREEN_SIZE, COLORS, DEFAULT_BLOCK_SIZE });

  if (!getCurrentPlayer(id)) {
    startReplay(id);
  }
}

function handleLandingStats(socket) {
  io.to(socket.id).emit("displayStats", getAllQueues());
}

function handleControlsConnect(socket) {
  const id = socket.nsp.name.split("_")[1];
  const nsp = io.of(`/display_${id}`);

  console.log("Controls connected:", socket.id, "display:", id);

  nsp
    .to(socket.id)
    .emit("gameConfig", { SCREEN_SIZE, COLORS, DEFAULT_BLOCK_SIZE });

  clearReplayTimers();

  // Add the socket to queue (will be at the end)
  if (addToQueue(id, socket.id)) {
    console.log("Added to queue:", socket.id);
    if (!getCurrentPlayer(id)) {
      const display = getDisplaySocket(id);

      if (!display) {
        console.log("No display connected, waiting for display...");
        return;
      }

      console.log("No current player, checking for next player...");
      const nextPlayer = getNextPlayer(id); // This sets currentPlayer
      console.log("Next player:", nextPlayer);
      if (nextPlayer === socket.id) {
        nsp.to(nextPlayer).emit("countdownStart");
        startCountdown(socket, id);
      }
    }

    // Update all clients with new queue status
    getAllQueueStatuses(id)
      .filter(({ status }) => !status?.isPlaying)
      .forEach(({ playerId, status }) => {
        nsp.to(playerId).emit("queueUpdate", status);
      });
  }
}

function handleGameAction(socket, { action }) {
  const id = socket.nsp.name.split("_")[1];
  const nsp = io.of(`/display_${id}`);

  const currentGame = getCurrentGame(id);

  if (socket.id !== getCurrentPlayer(id) || !currentGame.currentPiece) {
    console.log("Game action rejected:", {
      socketId: socket.id,
      currentPlayer: getCurrentPlayer(id),
      hasPiece: !!currentGame.currentPiece,
      action,
    });
    return;
  }

  let needsUpdate = true;
  let result = null;

  switch (action) {
    case "moveLeft":
      needsUpdate = moveLeft(id);
      break;

    case "moveRight":
      needsUpdate = moveRight(id);
      break;

    case "moveDown":
      result = dropPiece(id);
      if (result && result.gameOver) {
        handleGameOver(socket, id, result);
        return;
      }
      break;

    case "rotate":
      needsUpdate = rotate(id);
      break;

    default:
      needsUpdate = false;
  }

  if (needsUpdate || result) {
    recordGameMove(id);
    nsp.emit("updateGame", currentGame);
  }
}

function handleLeaveGame(socket) {
  cleanupPlayer(socket, socket.nsp.name.split("_")[1]);
}

function handleReconnect(socket) {
  const id = socket.nsp.name.split("_")[1];
  const nsp = io.of(`/display_${id}`);

  console.log("Client reconnected:", socket.id, "display:", id);
  nsp.emit("disableBlinking");
  const currentGame = getCurrentGame(id);
  clearTimeout(reconnectInterval[id]);

  // If this socket was the current player (e.g. on refresh or reconnect)
  if (getCurrentPlayer(id) === socket.id) {
    console.log("Current player reconnected:", socket.id);
    // Send them the current game state
    nsp.to(socket.id).emit("gameStart");
    nsp.emit("updateGame", currentGame);
  }
}

function cleanupPlayer(socket, id) {
  console.log("Removing client", socket.id);
  const nsp = io.of(`/display_${id}`);

  nsp.emit("disableBlinking");

  if (removePlayer(id, socket.id)) {
    clearDropInterval(id);
    // Update remaining players' queue positions
    getAllQueueStatuses(id).forEach(({ playerId, status }) => {
      nsp.to(playerId).emit("queueUpdate", status);
    });

    // Get next player or start replay immediately
    const nextPlayer = getNextPlayer(id);
    if (nextPlayer) {
      nsp.to(nextPlayer).emit("countdownStart");
      startCountdown(socket, id);
    } else if (getDisplaySocket(id)) {
      // If display is connected and no players left, start replay immediately
      startReplay(id);
    }
  }
}

function startGame(socket) {
  const id = socket.nsp.name.split("_")[1];
  const nsp = io.of(`/display_${id}`);
  resetGame(id);

  const currentPlayer = getCurrentPlayer(id);

  nsp.to(currentPlayer).emit("gameStart");
  startNewGame(socket, id); // Reset and start game for next player
}

function startCountdown(socket) {
  let countDown = 5;
  const id = socket.nsp.name.split("_")[1];
  const nsp = io.of(`/display_${id}`);
  resetGame(id);
  const display = getDisplaySocket(id);
  const currentGame = getCurrentGame(id);
  const player = getCurrentPlayer(id);
  currentGame.nextPiece = null;

  console.log("Starting countdown for player:", display.id);
  nsp.to(display.id).to(player).emit("updateGame", currentGame);

  const cleanUp = () => {
    currentGame.currentPiece = null;

    nsp.to(display.id).to(player).emit("updateGame", currentGame);
  };

  const drawPiece = () => {
    currentGame.currentPiece = createDigit(countDown);
    currentGame.currentY = Math.round(SCREEN_SIZE.rows / 3) - 5; // digit height

    nsp.to(display.id).to(player).emit("updateGame", currentGame);

    setTimeout(() => {
      cleanUp();
      countDown -= 1;

      if (countDown > 0) {
        setTimeout(() => {
          drawPiece();
        }, 500);
      } else {
        setTimeout(() => {
          startGame(socket);
        }, 1000);
      }
    }, 500);
  };

  drawPiece();
}

function handleDisconnect(socket) {
  const id = socket.nsp.name.split("_")[1];
  const nsp = io.of(`/display_${id}`);

  console.log("Client disconnected:", socket.id, "display:", id);

  if (socket.id === getDisplaySocket(id)?.id) {
    console.log("Display disconnected:");
    setDisplaySocket(id, null);
    clearReplayTimers();
    return;
  }

  if (socket.id === getCurrentPlayer(id)) {
    nsp.emit("enableBlinking");
    reconnectInterval[id] = setTimeout(() => {
      cleanupPlayer(socket, id);
    }, RECONNECT_WAIT);
  } else {
    cleanupPlayer(socket, id);
  }
}

const setup = (server) => {
  io = server;
};

export {
  setup,
  handleDisplayConnect,
  handleControlsConnect,
  handleGameAction,
  handleDisconnect,
  handleReconnect,
  handleLeaveGame,
  handleLandingStats,
  clearDropInterval,
};
