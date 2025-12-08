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
  // Update global queue info - REMOVED (per screen now)
  const { screens } = data;
  const queueLengthEl = document.getElementById("queue-length");
  if (queueLengthEl) {
    queueLengthEl.style.display = "none";
  }

  // Update screen statuses - show only first 3 screens
  const screensContainer = document.getElementById("screens-status");
  if (screensContainer) {
    screensContainer.innerHTML = "";

    // Filter to show only first 3 screens
    const screensToShow = screens.slice(0, 3);
    
    screensToShow.forEach((screen) => {
      // Create clickable card
      const screenLink = document.createElement("a");
      screenLink.className = "screen-status-card";
      screenLink.href = `/play?screen=${screen.id}`;
      screenLink.style.textDecoration = "none";
      screenLink.style.display = "block";

      const screenDiv = document.createElement("div");
      screenDiv.className = "screen-status";
      // Add hover effect style inline or class
      screenDiv.style.cursor = "pointer";
      screenDiv.style.transition = "transform 0.2s, box-shadow 0.2s";

      const screenNumber = screen.id.split("_")[1] || screen.id;
      const title = document.createElement("h3");
      title.textContent = `${currentLanguage === "lt" ? "Ekranas" : "Screen"} ${screenNumber}`;

      const status = document.createElement("div");
      status.className = "status-text";

      const queueInfo = document.createElement("div");
      queueInfo.className = "screen-queue-info";
      queueInfo.style.fontSize = "0.9em";
      queueInfo.style.marginTop = "5px";
      queueInfo.style.color = "#aaa";

      if (!screen.displayConnected) {
        status.textContent = currentLanguage === "lt" ? "Neprijungtas" : "Disconnected";
        status.style.color = "#666";
        screenLink.style.pointerEvents = "none"; // Disable clicking if disconnected
        screenDiv.style.opacity = "0.5";
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

      // Queue info
      const qLen = screen.queueLength || 0;
      queueInfo.textContent = currentLanguage === "lt"
        ? `Eilėje: ${qLen}`
        : `In queue: ${qLen}`;

      screenDiv.appendChild(title);
      screenDiv.appendChild(status);
      screenDiv.appendChild(queueInfo);

      screenLink.appendChild(screenDiv);
      screensContainer.appendChild(screenLink);
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
