import { writeFile } from "fs";
import { SCREEN_SIZE, DROP_SPEEDS } from "../../config.js";

// Initial game state
const createInitialState = () => ({
  board: Array(SCREEN_SIZE.rows)
    .fill()
    .map(() => Array(SCREEN_SIZE.cols).fill(0)),
  currentPiece: null,
  nextPiece: null,
  currentX: 3,
  currentY: 0,
  score: 0,
  level: 1,
  lines: 0,
  dropSpeed: DROP_SPEEDS[1],
  lastGameState: null,
  replayTimeout: null,
  isWaitingForReplay: false,
});

let activeGames = {};
let gameMovesHistory = {};

function getCurrentGame(id) {
  if (!activeGames[id]) {
    activeGames[id] = createInitialState();
  }
  return activeGames[id];
}

function getMovesHistory(id) {
  return gameMovesHistory[id];
}

// Record game moves for replay
function recordGameMove(id) {
  if (!gameMovesHistory[id]) {
    gameMovesHistory[id] = [];
  }
  const lastGameMoves = gameMovesHistory[id];
  const currentGame = activeGames[id];

  lastGameMoves.push({
    board: JSON.parse(JSON.stringify(currentGame.board)),
    piece: currentGame.currentPiece
      ? JSON.parse(JSON.stringify(currentGame.currentPiece))
      : null,
    nextPiece: currentGame.nextPiece
      ? JSON.parse(JSON.stringify(currentGame.nextPiece))
      : null,
    x: currentGame.currentX,
    y: currentGame.currentY,
  });
}

function resetGame(id) {
  if (gameMovesHistory[id]?.length ?? 0 > 0) {
    // writeFile(
    //   "./moves.json",
    //   gameMovesHistory[id],
    //   { encoding: "utf8" },
    //   () => {
    //     console.log("Game moves saved to file");
    //   }
    // );
  }

  activeGames[id] = createInitialState();
  gameMovesHistory[id] = [];
}

export { getCurrentGame, getMovesHistory, recordGameMove, resetGame };
