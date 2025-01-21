const REPEAT_DELAY = 200; // ms before key repeat starts
const REPEAT_RATE = 50; // ms between repeats

class GameControls {
  isPlaying = false;
  socket = null;
  touchStartTime = 0;
  repeatInterval = null;
  keyState = {};

  // Action mapping for buttons
  actionMap = {
    left: "moveLeft",
    right: "moveRight",
    down: "moveDown",
    rotate: "rotate",
  };

  constructor(socket) {
    this.socket = socket;
    // this.setupControlEvents();
  }

  sendAction(action) {
    if (!this.isPlaying || !this.socket) return;
    this.socket.emit("gameUpdate", { action });
  }

  startRepeat(action) {
    if (this.repeatInterval) clearInterval(this.repeatInterval);
    this.sendAction(action);
    this.touchStartTime = Date.now();
    this.repeatInterval = setInterval(() => {
      if (Date.now() - this.touchStartTime >= REPEAT_DELAY) {
        this.sendAction(action);
      }
    }, REPEAT_RATE);
  }

  stopRepeat() {
    if (this.repeatInterval) {
      clearInterval(this.repeatInterval);
      this.repeatInterval = null;
    }
  }

  setupControlEvents() {
    // Touch and mouse controls
    document.querySelectorAll(".btn[data-action]").forEach((button) => {
      const action = this.actionMap[button.dataset.action];
      if (action) {
        // Touch events
        button.addEventListener(
          "touchstart",
          (e) => {
            // e.preventDefault();
            if (
              action === "moveLeft" ||
              action === "moveRight" ||
              action === "moveDown"
            ) {
              this.startRepeat(action);
            } else {
              this.sendAction(action);
            }
          },
          { passive: true }
        );

        button.addEventListener("touchend", (e) => {
          e.preventDefault();
          this.stopRepeat();
        });

        button.addEventListener("touchcancel", (e) => {
          e.preventDefault();
          this.stopRepeat();
        });

        // Mouse events (for testing on desktop)
        button.addEventListener("mousedown", () => {
          if (
            action === "moveLeft" ||
            action === "moveRight" ||
            action === "moveDown"
          ) {
            this.startRepeat(action);
          } else {
            this.sendAction(action);
          }
        });

        button.addEventListener("mouseup", () => {
          this.stopRepeat();
        });

        button.addEventListener("mouseleave", () => {
          this.stopRepeat();
        });
      }
    });

    // Event listeners
    window.addEventListener("keydown", this.handleKeydown.bind(this));
    window.addEventListener("keyup", this.handleKeyup.bind(this));
    window.addEventListener("blur", () => {
      this.stopRepeat();
      Object.keys(this.keyState).forEach((key) => (this.keyState[key] = false));
    });

    // Prevent scrolling on mobile
    document.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length === 1) {
          e.preventDefault();
        }
      },
      { passive: false }
    );
  }

  // Keyboard controls
  handleKeydown(event) {
    if (!this.isPlaying || event.repeat) return;

    let action = null;
    switch (event.key) {
      case "ArrowLeft":
        action = "moveLeft";
        break;
      case "ArrowRight":
        action = "moveRight";
        break;
      case "ArrowDown":
        action = "moveDown";
        break;
      case "ArrowUp":
        action = "rotate";
        break;
    }

    if (action) {
      event.preventDefault();
      this.keyState[action] = true;
      if (
        action === "moveLeft" ||
        action === "moveRight" ||
        action === "moveDown"
      ) {
        this.startRepeat(action);
      } else {
        this.sendAction(action);
      }
    }
  }

  handleKeyup(event) {
    let action = null;
    switch (event.key) {
      case "ArrowLeft":
        action = "moveLeft";
        break;
      case "ArrowRight":
        action = "moveRight";
        break;
      case "ArrowDown":
        action = "moveDown";
        break;
    }

    if (action) {
      event.preventDefault();
      this.stopRepeat();
      this.keyState[action] = false;
    }
  }

  setPlaying(playing) {
    this.isPlaying = playing;
  }

  setSocket(socket) {
    this.socket = socket;
  }

  // TODO: remove maybe, it's not used
  cleanup() {
    window.removeEventListener("keydown", this.handleKeydown);
    window.removeEventListener("keyup", this.handleKeyup);
    this.stopRepeat();
  }
  // return {
  //   setPlaying: (playing) => {
  //     this.isPlaying = playing;
  //   },
  //   cleanup: () => {
  //     window.removeEventListener("keydown", handleKeydown);
  //     window.removeEventListener("keyup", handleKeyup);
  //     stopRepeat();
  //   },
  // };
}

export { GameControls };
