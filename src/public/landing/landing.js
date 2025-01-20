let currentLanguage = "lt";
let pollTimeout = null;

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

document.addEventListener("DOMContentLoaded", () => {
  const socket = io({
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
  });

  // Initialize particles on load
  createParticles();

  document
    .getElementById("language-switcher")
    .addEventListener("click", toggleLanguage);

  socket.emit("landingConnect");

  socket.on("displayStats", (stats) => {
    document.getElementById("button-grid").innerHTML = "";

    stats.forEach((display) => {
      const button = document.createElement("a");
      button.className = "menu-button";
      button.href = `/play?id=${display.id}`;
      button.textContent = `Nr. ${display.id}`;

      const stats = document.createElement("div");
      stats.className = "menu-stats";
      const lt = `Žaidėjų: ${display.stats.length}`;
      const en = `Players: ${display.stats.length}`;
      const phrase = { lt, en };

      stats.setAttribute("data-lt", lt);
      stats.setAttribute("data-en", en);

      stats.textContent = phrase[currentLanguage];

      button.appendChild(stats);

      document.getElementById("button-grid").appendChild(button);
    });
  });

  pollTimeout = setInterval(() => {
    socket.emit("landingConnect");
  }, 5000);
});
