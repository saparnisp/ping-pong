import { SCREEN_SIZE } from "../../config.js";

// Tetris pieces with their corresponding color indices
const TETROMINOES = [
  { shape: [[1, 1, 1, 1]], color: 1 }, // I - cyan
  {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: 4,
  }, // O - yellow
  {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
    ],
    color: 7,
  }, // T - purple
  {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
    ],
    color: 3,
  }, // L - orange
  {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
    ],
    color: 2,
  }, // J - blue
  {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
    color: 5,
  }, // S - green
  {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    color: 6,
  }, // Z - red
];

function createPiece() {
  const pieceIdx = Math.floor(Math.random() * TETROMINOES.length);
  const { shape, color } = TETROMINOES[pieceIdx];
  const piece = shape.map((row) => row.map((cell) => (cell ? color : 0)));
  return piece;
}

function collision(piece, board, x, y) {
  for (let row = 0; row < piece.length; row++) {
    for (let col = 0; col < piece[row].length; col++) {
      if (piece[row][col]) {
        const newX = x + col;
        const newY = y + row;
        if (newX < 0 || newX >= SCREEN_SIZE.cols || newY >= SCREEN_SIZE.rows)
          return true;
        if (newY >= 0 && board[newY][newX]) return true;
      }
    }
  }
  return false;
}

function freezePiece(piece, board, x, y) {
  for (let row = 0; row < piece.length; row++) {
    for (let col = 0; col < piece[row].length; col++) {
      if (piece[row][col]) {
        board[y + row][x + col] = piece[row][col];
      }
    }
  }
  return board;
}

function rotatePiece(piece) {
  const newPiece = piece[0].map((_, i) => piece.map((row) => row[i]).reverse());
  return newPiece;
}

export { TETROMINOES, createPiece, collision, freezePiece, rotatePiece };
