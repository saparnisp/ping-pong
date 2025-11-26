/**
 * PONG LANDING PAGE
 * Shows global queue and screen statuses
 */

let currentLanguage = "lt";
let pollTimeout = null;
let socket = null;

// Create floating light particles
function createParticles() {
  const container = document.querySelector(".background-effects");
  for (let i = 0; i < 50; i++) {
    const particle = document.createElement("div");
    particle.className = "light-particle";
    particle.style.left = Math.random() * 100 + "vw";
    particle.style.animationDelay = Math.random() * 5 + "s";
    particle.style.animationDuration = Math.random() * 6 + 6 + "s";
    container.appendChild(particle);
  }
}

function updateTexts() {
  document.querySelectorAll("[data-lt]").forEach((element) => {
    element.textContent = element.getAttribute(`data-${currentLanguage}`);
  });
}

function toggleLanguage() {
  currentLanguage = currentLanguage === "lt" ? "en" : "lt";
  updateTexts();
  document.getElementById("language-switcher").textContent =
    currentLanguage === "lt" ? "EN" : "LT";
}

/**
 * Update screen statuses display
 */
function updateScreenStatuses(data) {
  const { screens, queue } = data;

  // Update global queue info
  const queueLengthEl = document.getElementById("queue-length");
  if (queueLengthEl) {
    const queueText = currentLanguage === "lt"
      ? `Žaidėjų eilėje: ${queue.queueLength}`
      : `Players in queue: ${queue.queueLength}`;
    queueLengthEl.textContent = queueText;
  }

  // Update screen statuses
  const screensContainer = document.getElementById("screens-status");
  if (screensContainer) {
    screensContainer.innerHTML = "";

    screens.forEach((screen) => {
      const screenDiv = document.createElement("div");
      screenDiv.className = "screen-status";

      const screenNumber = screen.id.split("_")[1] || screen.id;
      const title = document.createElement("h3");
      title.textContent = `${currentLanguage === "lt" ? "Ekranas" : "Screen"} ${screenNumber}`;

      const status = document.createElement("div");
      status.className = "status-text";

      if (!screen.displayConnected) {
        status.textContent = currentLanguage === "lt" ? "Neprijungtas" : "Disconnected";
        status.style.color = "#666";
      } else if (screen.gameActive) {
        status.textContent = currentLanguage === "lt"
          ? "Žaidžiama..."
          : "Game in progress...";
        status.style.color = "#0f0";
      } else if (screen.waitingForChallenger) {
        status.textContent = currentLanguage === "lt"
          ? "Laukia priešininko"
          : "Waiting for challenger";
        status.style.color = "#ff0";
      } else {
        status.textContent = currentLanguage === "lt" ? "Laisvas" : "Free";
        status.style.color = "#0ff";
      }

      screenDiv.appendChild(title);
      screenDiv.appendChild(status);
      screensContainer.appendChild(screenDiv);
    });
  }
}

/**
 * Connect to server
 */
function connectToServer() {
  socket = io({
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
  });

  socket.on("connect", () => {
    console.log("Connected to server");
    socket.emit("landingStats");
  });

  socket.on("displayStats", (data) => {
    console.log("Display stats:", data);
    updateScreenStatuses(data);
  });

  socket.on("screenStatuses", (data) => {
    console.log("Screen statuses update:", data);
    updateScreenStatuses(data);
  });

  // Poll for updates every 5 seconds
  pollTimeout = setInterval(() => {
    socket.emit("landingStats");
  }, 5000);
}

document.addEventListener("DOMContentLoaded", () => {
  // Initialize particles on load
  createParticles();

  // Language switcher
  document
    .getElementById("language-switcher")
    .addEventListener("click", toggleLanguage);

  updateTexts();

  // Connect to server
  connectToServer();
});
