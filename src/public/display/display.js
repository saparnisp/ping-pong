// var noSleep = new NoSleep();
// noSleep.enable();

import { createDigit } from "../shared/digits.js";
import { pSBC } from "../shared/psb.js";

let showNumber = true;
let COLORS;
let SCREEN_SIZE;
let block_size;
let colorGlow = 1;
let delta = 0.01;
let glowInterval;

const storedBlockSize = parseInt(localStorage.getItem("block_size"));

if (!isNaN(storedBlockSize)) {
  block_size = storedBlockSize;
}

const recalculateEvent = new CustomEvent("recalculate", {
  bubbles: false,
});

const getId = () => {
  let params = new URLSearchParams(document.location.search);
  let id = params.get("id");

  return id;
};

const handleKeyup = (event) => {
  switch (event.key) {
    case "=":
      if (block_size < 100) {
        block_size += 1;
        document.dispatchEvent(recalculateEvent);
        localStorage.setItem("block_size", block_size);
      }
      break;
    case "-":
      if (block_size > 1) {
        block_size -= 1;
        document.dispatchEvent(recalculateEvent);
        localStorage.setItem("block_size", block_size);
      }
      break;
  }
};

document.addEventListener("DOMContentLoaded", () => {
  document.addEventListener("keyup", handleKeyup);

  const id = getId();

  if (!id) {
    // TODO: Ask server for the next id?
    console.error("No display ID found in URL!");
    return;
  }

  const socket = io(`/display_${id}`, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
  });
  const canvas = document.getElementById("tetrisCanvas");
  const ctx = canvas.getContext("2d");

  function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#333";
    for (let i = 0; i <= canvas.width; i += block_size) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i <= canvas.height; i += block_size) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }
  }

  function startGlow() {
    if (glowInterval) {
      return;
    }

    glowInterval = setInterval(() => {
      if (colorGlow > 1) {
        delta = -0.04;
      } else if (colorGlow < -0.5) {
        delta = 0.04;
      }
      colorGlow += delta;
      drawNumber();
    }, 50);
  }

  function stopGlow() {
    colorGlow = 1;
    clearInterval(glowInterval);
    glowInterval = null;
  }

  function cleanUp() {
    for (let y = 0; y < SCREEN_SIZE.rows; y++) {
      for (let x = 0; x < SCREEN_SIZE.cols; x++) {
        drawBlock(x, y, 0);
      }
    }
  }

  function drawBlock(x, y, colorIndex, glow = false) {
    if (colorIndex === "x") {
      ctx.fillStyle = "#ddd";
    } else {
      ctx.fillStyle = glow
        ? pSBC(colorGlow, COLORS[colorIndex])
        : COLORS[colorIndex];
    }

    ctx.fillRect(
      x * block_size,
      y * block_size,
      block_size - 1,
      block_size - 1
    );
    ctx.strokeStyle = "#333";
    ctx.strokeRect(x * block_size, y * block_size, block_size, block_size);
  }

  function drawNumber() {
    const screenNumber = createDigit(id);
    const yOffset = Math.round(SCREEN_SIZE.rows / 2) - 4;
    if (screenNumber) {
      for (let y = 0; y < screenNumber.length; y++) {
        for (let x = 0; x < screenNumber[y].length; x++) {
          if (screenNumber[y][x]) {
            drawBlock(x + 3, y + yOffset, screenNumber[y][x], true);
          }
        }
      }
    }
  }

  socket.on("countdownStart", () => {
    stopGlow();
    showNumber = false;
    cleanUp();
  });

  socket.on("updateGame", (gameState) => {
    if (!gameState) return;
    drawGrid();

    // Draw board
    for (let y = 0; y < gameState.board.length; y++) {
      for (let x = 0; x < gameState.board[y].length; x++) {
        if (gameState.board[y][x]) {
          drawBlock(x, y, gameState.board[y][x]);
        }
      }
    }

    // Draw current piece
    if (gameState.currentPiece) {
      for (let y = 0; y < gameState.currentPiece.length; y++) {
        for (let x = 0; x < gameState.currentPiece[y].length; x++) {
          if (gameState.currentPiece[y][x]) {
            drawBlock(
              gameState.currentX + x,
              gameState.currentY + y,
              gameState.currentPiece[y][x]
            );
          }
        }
      }
    }
    if (showNumber) {
      drawNumber();
    }
  });

  document.addEventListener(
    "recalculate",
    () => {
      canvas.width = SCREEN_SIZE.cols * block_size;
      canvas.height = SCREEN_SIZE.rows * block_size;
    },
    false
  );

  socket.on("replayStart", () => {
    showNumber = true;
    startGlow();
  });

  socket.on("enableBlinking", () => {
    const canvas = document.getElementById("tetrisCanvas");
    canvas.className = "blinking";
  });

  socket.on("disableBlinking", () => {
    const canvas = document.getElementById("tetrisCanvas");
    canvas.className = "";
  });

  socket.on("gameConfig", (config) => {
    const canvas = document.getElementById("tetrisCanvas");

    COLORS = config.COLORS;
    block_size = config.DEFAULT_BLOCK_SIZE;
    SCREEN_SIZE = config.SCREEN_SIZE;
    canvas.width = SCREEN_SIZE.cols * block_size;
    canvas.height = SCREEN_SIZE.rows * block_size;

    drawGrid();
    drawNumber();
    startGlow();
  });

  socket.emit("displayConnect");
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    postMessage("continue-processing");
  }
});

document.addEventListener("beforeunload", () => {
  postMessage("continue-processing");
});
