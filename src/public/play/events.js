class SocketHandler {
  socket;
  constructor(display, controls, socket) {
    // Clear any previous game state
    localStorage.removeItem("lastGameData");
    this.socket = socket;
    this.display = display;
    this.controls = controls;

    // Initialize game state
    this.display.hideGameElements();
    this.display.showWaitingScreen();

    this.setupEventListeners();
    this.setupErrorHandlers();

    // Production mode check
    this.isProduction = window.location.hostname !== "localhost";
  }

  setupErrorHandlers() {
    // Handle connection errors
    this.socket.on("connect_error", (error) => {
      if (!this.isProduction) {
        console.error("Connection error:", error);
      }
      this.display.showWaitingScreen();
    });

    // Handle disconnection
    this.socket.on("disconnect", (reason) => {
      if (!this.isProduction) {
        console.log("Disconnected:", reason);
      }
      this.display.showWaitingScreen();
      if (reason === "io server disconnect") {
        setTimeout(() => {
          this.socket.connect();
        }, 1000);
      }
    });

    // Handle successful connection
    this.socket.on("connect", () => {
      if (!this.isProduction) {
        console.log("Connected to server");
      }
    });
  }

  setupEventListeners() {
    // Queue updates
    this.socket.on("queueUpdate", (data) => {
      this.display.updateQueueStatus(data);
    });

    // Game start
    this.socket.on("gameStart", () => {
      if (navigator?.vibrate) {
        navigator.vibrate([200]);
      }
      this.controls.setPlaying(true);
      this.display.hideWaitingScreen();
      this.display.showGameElements();
    });

    // Game updates
    this.socket.on("updateGame", (gameState) => {
      this.display.updateGameInfo(gameState);
    });

    // Level up
    this.socket.on("levelUp", () => {
      this.display.handleLevelUp();
    });

    // Game end
    this.socket.on("gameEnd", (data) => {
      this.controls.setPlaying(false);
      this.display.hideGameElements();

      if (data) {
        // Save game data to localStorage
        localStorage.setItem(
          "lastGameData",
          JSON.stringify({
            score: data.score,
            lines: data.lines,
            level: data.level,
          })
        );

        // Use setTimeout to ensure game state is saved before redirect
        setTimeout(() => {
          window.location.assign("/");
        }, 100);
      }
    });

    // Handle close button click
    document.getElementById("closeButton")?.addEventListener("click", () => {
      document
        .getElementById("gameOverScreen")
        ?.style.setProperty("display", "none");
      window.location.href = "/";
    });

    // Handle start button click
    document.getElementById("start-button")?.addEventListener("click", () => {
      this.socket.emit("startGame");
    });

    // Cleanup on page unload
    window.addEventListener("beforeunload", () => {
      // Clear any game state
      localStorage.removeItem("lastGameData");

      // Notify server of disconnection
      this.socket.emit("forceDisconnect");

      // Disconnect socket
      this.socket.disconnect();

      // Ensure game elements are hidden
      this.display.hideGameElements();
      console.log("unload?!");

      this.display.showWaitingScreen();
    });
  }

  // TODO: No longer used!
  connectAsControls() {
    console.log("Connecting as controls");
    this.display.showWaitingScreen();
    // this.controls.cleanup();
    // this.controls.setupControlEvents();
  }

  getSocket() {
    return this.socket;
  }
}

export { SocketHandler };
