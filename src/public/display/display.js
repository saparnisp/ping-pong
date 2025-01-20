// var noSleep = new NoSleep();
// noSleep.enable();

let COLORS;
let SCREEN_SIZE;
let block_size;
const storedBlockSize = parseInt(localStorage.getItem("block_size"));

if (!isNaN(storedBlockSize)) {
  block_size = storedBlockSize;
}

if (storedBlockSize) {
  console.log("restored block_size =", block_size);
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
        console.log("new block_size =", block_size);
        document.dispatchEvent(recalculateEvent);
        localStorage.setItem("block_size", block_size);
      }
      break;
    case "-":
      if (block_size > 1) {
        block_size -= 1;
        console.log("new block_size", block_size);
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

  const socket = io(`/display_${id}`);
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

  function drawBlock(x, y, colorIndex) {
    ctx.fillStyle = COLORS[colorIndex];
    ctx.fillRect(
      x * block_size,
      y * block_size,
      block_size - 1,
      block_size - 1
    );
    ctx.strokeStyle = "#333";
    ctx.strokeRect(x * block_size, y * block_size, block_size, block_size);
  }

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
  });

  document.addEventListener(
    "recalculate",
    () => {
      canvas.width = SCREEN_SIZE.cols * block_size;
      canvas.height = SCREEN_SIZE.rows * block_size;
    },
    false
  );

  socket.on("gameEnded", () => {
    // Notify server we're ready for replay
    socket.emit("readyForReplay");
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
  });

  socket.emit("displayConnect");
});
