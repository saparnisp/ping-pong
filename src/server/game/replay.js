import { getCurrentGame, getMovesHistory } from "./state.js";
import { getCurrentPlayer, getDisplaySocket } from "./queue.js";
import { SCREEN_SIZE } from "../../config.js";

let replayInterval = {};
let replayTimeout = {};

function clearReplayTimers(id) {
  if (replayInterval[id]) {
    clearInterval(replayInterval[id]);
    replayInterval[id] = null;
  }
  if (replayTimeout[id]) {
    clearTimeout(replayTimeout[id]);
    replayTimeout[id] = null;
  }
}

function startReplay(id) {
  const lastGameMoves = getMovesHistory(id);
  const currentGame = getCurrentGame(id);

  const displaySocket = getDisplaySocket(id);
  if (!lastGameMoves || !displaySocket || replayInterval[id]) return;

  let moveIndex = 0;

  // Reset game state for replay
  currentGame.board = Array(SCREEN_SIZE.rows)
    .fill()
    .map(() => Array(SCREEN_SIZE.cols).fill(0));
  currentGame.score = 0;
  currentGame.level = 1;
  currentGame.lines = 0;

  console.log("Starting replay with", lastGameMoves.length, "moves");
  displaySocket.emit("replayStart");

  replayInterval[id] = setInterval(() => {
    // Stop replay if a player joins
    if (getCurrentPlayer(id)) {
      console.log("Stopping replay - new player joined");
      clearReplayTimers(id);
      return;
    }

    if (moveIndex >= lastGameMoves.length) {
      // End of replay, wait 5 seconds and start again
      console.log("Replay finished, restarting in 5 seconds");
      clearInterval(replayInterval[id]);
      replayInterval[id] = null;

      replayTimeout[id] = setTimeout(() => {
        if (!getCurrentPlayer(id) && getDisplaySocket(id)) {
          // Only restart if no active player
          console.log("Restarting replay");
          startReplay(id);
        }
      }, 5000);
      return;
    }

    const move = lastGameMoves[moveIndex];
    currentGame.board = JSON.parse(JSON.stringify(move.board));
    currentGame.currentPiece = move.piece
      ? JSON.parse(JSON.stringify(move.piece))
      : null;
    currentGame.nextPiece = move.nextPiece
      ? JSON.parse(JSON.stringify(move.nextPiece))
      : null;
    currentGame.currentX = move.x;
    currentGame.currentY = move.y;
    currentGame.score = move.score;
    currentGame.level = move.level;
    currentGame.lines = move.lines;

    displaySocket.emit("updateGame", currentGame);
    moveIndex++;
  }, 100); // Update every 100ms for smooth replay
}

function scheduleReplay(id, delay = 5000) {
  if (replayTimeout[id]) {
    clearTimeout(replayTimeout[id]);
  }

  replayTimeout[id] = setTimeout(() => {
    if (!getCurrentPlayer(id) && getDisplaySocket(id)) {
      console.log("Starting scheduled replay");
      startReplay(id);
    }
  }, delay);
}

export { startReplay, clearReplayTimers, scheduleReplay };
