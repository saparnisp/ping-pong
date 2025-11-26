/**
 * PONG CONTROLLER - Touch-Based Paddle Control
 * Direct paddle control via touch/drag
 */

class PongControls {
  isPlaying = false;
  socket = null;
  isDragging = false;
  touchStartY = null;
  paddleAreaHeight = 0;
  paddleElement = null;
  controlAreaElement = null;

  constructor(socket) {
    this.socket = socket;
  }

  /**
   * Send paddle position to server
   * @param {number} normalizedY - Y position from 0 (top) to 1 (bottom)
   */
  sendPaddlePosition(normalizedY) {
    if (!this.socket) {
      console.error("No socket available!");
      return;
    }

    // Allow sending position even when not playing - server will handle validation
    // This ensures responsive controls during countdown, etc.

    // Clamp between 0 and 1
    const clampedY = Math.max(0, Math.min(1, normalizedY));

    console.log("Sending paddle position:", clampedY.toFixed(2));
    this.socket.emit("paddlePosition", { position: clampedY });
  }

  /**
   * Setup touch and drag controls
   */
  setupControlEvents() {
    console.log("Setting up drag controls...");

    this.controlAreaElement = document.getElementById("paddle-control-area");
    this.paddleElement = document.getElementById("draggable-paddle");

    if (!this.controlAreaElement || !this.paddleElement) {
      console.error("Control elements not found!");
      return;
    }

    this.paddleAreaHeight = this.controlAreaElement.clientHeight;

    // Touch events for mobile
    this.controlAreaElement.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this.handleDragStart(e.touches[0].clientY);
    }, { passive: false });

    this.controlAreaElement.addEventListener("touchmove", (e) => {
      e.preventDefault();
      this.handleDragMove(e.touches[0].clientY);
    }, { passive: false });

    this.controlAreaElement.addEventListener("touchend", (e) => {
      e.preventDefault();
      this.handleDragEnd();
    });

    // Mouse events for desktop testing
    this.controlAreaElement.addEventListener("mousedown", (e) => {
      e.preventDefault();
      this.handleDragStart(e.clientY);
    });

    this.controlAreaElement.addEventListener("mousemove", (e) => {
      if (this.isDragging) {
        e.preventDefault();
        this.handleDragMove(e.clientY);
      }
    });

    this.controlAreaElement.addEventListener("mouseup", (e) => {
      e.preventDefault();
      this.handleDragEnd();
    });

    this.controlAreaElement.addEventListener("mouseleave", (e) => {
      if (this.isDragging) {
        this.handleDragEnd();
      }
    });

    // Keyboard controls as backup
    window.addEventListener("keydown", this.handleKeydown.bind(this));
    window.addEventListener("keyup", this.handleKeyup.bind(this));

    // Prevent scrolling on mobile
    document.addEventListener("touchmove", (e) => {
      if (e.touches.length === 1) {
        e.preventDefault();
      }
    }, { passive: false });

    // Handle window resize
    window.addEventListener("resize", () => {
      this.paddleAreaHeight = this.controlAreaElement.clientHeight;
    });

    console.log("Drag controls initialized");
  }

  handleDragStart(clientY) {
    if (!this.isPlaying) {
      console.warn("Game not started yet");
      return;
    }

    this.isDragging = true;
    this.updatePaddlePosition(clientY);
  }

  handleDragMove(clientY) {
    if (!this.isDragging || !this.isPlaying) return;
    this.updatePaddlePosition(clientY);
  }

  handleDragEnd() {
    this.isDragging = false;
  }

  updatePaddlePosition(clientY) {
    const rect = this.controlAreaElement.getBoundingClientRect();
    const relativeY = clientY - rect.top;

    // Calculate normalized position (0 = top, 1 = bottom)
    const normalizedY = relativeY / rect.height;

    // Update visual paddle position
    const clampedY = Math.max(0, Math.min(1, normalizedY));
    const paddleHeight = this.paddleElement.clientHeight;
    const maxY = rect.height - paddleHeight;
    this.paddleElement.style.top = `${clampedY * maxY}px`;

    // Send to server
    this.sendPaddlePosition(clampedY);
  }

  // Keyboard controls (arrow keys)
  currentDirection = null;
  keyboardInterval = null;

  handleKeydown(event) {
    if (!this.isPlaying || event.repeat) return;

    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.startKeyboardMove("up");
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      this.startKeyboardMove("down");
    }
  }

  handleKeyup(event) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      this.stopKeyboardMove();
    }
  }

  startKeyboardMove(direction) {
    if (this.keyboardInterval) return;

    this.currentDirection = direction;

    // Get current paddle position
    const rect = this.controlAreaElement.getBoundingClientRect();
    const paddleRect = this.paddleElement.getBoundingClientRect();
    const currentY = paddleRect.top - rect.top;
    let normalizedY = currentY / rect.height;

    // Move paddle continuously
    this.keyboardInterval = setInterval(() => {
      if (direction === "up") {
        normalizedY -= 0.02; // Move up
      } else {
        normalizedY += 0.02; // Move down
      }

      normalizedY = Math.max(0, Math.min(1, normalizedY));

      // Update visual
      const paddleHeight = this.paddleElement.clientHeight;
      const maxY = rect.height - paddleHeight;
      this.paddleElement.style.top = `${normalizedY * maxY}px`;

      // Send to server
      this.sendPaddlePosition(normalizedY);
    }, 16); // ~60 FPS
  }

  stopKeyboardMove() {
    if (this.keyboardInterval) {
      clearInterval(this.keyboardInterval);
      this.keyboardInterval = null;
      this.currentDirection = null;
    }
  }

  setPlaying(playing) {
    console.log("Setting playing state:", playing);
    this.isPlaying = playing;

    if (playing) {
      // Center paddle when game starts
      if (this.paddleElement && this.controlAreaElement) {
        const rect = this.controlAreaElement.getBoundingClientRect();
        const paddleHeight = this.paddleElement.clientHeight;
        const maxY = rect.height - paddleHeight;
        this.paddleElement.style.top = `${maxY / 2}px`;
      }
    } else {
      this.isDragging = false;
      this.stopKeyboardMove();
    }
  }

  setSocket(socket) {
    this.socket = socket;
  }

  cleanup() {
    window.removeEventListener("keydown", this.handleKeydown);
    window.removeEventListener("keyup", this.handleKeyup);
    this.stopKeyboardMove();
    this.isDragging = false;
  }
}

export { PongControls as GameControls };
