import http from "node:http";
import { Server } from "socket.io";
import { app, start } from "./server/host.js";
import { loadScores } from "./server/game/scores.js";
import {
  setup,
  handleDisplayConnect,
  handleControlsConnect,
  handleGameAction,
  handleDisconnect,
  handleReconnect,
  handleLeaveGame,
  clearDropInterval,
  handleLandingStats,
} from "./server/socket/handlers.js";

// Create HTTP server
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

const io = new Server(server, {
  connectionStateRecovery: {
    // the backup duration of the sessions and the packets
    maxDisconnectionDuration: 5 * 60 * 1000,
    // whether to skip middlewares upon successful recovery
    skipMiddlewares: true,
  },
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
  pingTimeout: 30000,
  pingInterval: 10000,
});

const namespace = io.of(/^\/display_\d+$/);
setup(io);

// Debug Socket.IO events
io.engine.on("connection_error", (err) => {
  console.log("Connection error:", err.req); // the request object
  console.log("Error message:", err.code); // the error code, for example 1
  console.log("Error message:", err.message); // the error message, for example "Session ID unknown"
  console.log("Error context:", err.context); // some additional error context
});

io.on("connection", (socket) => {
  socket.on("landingConnect", () => {
    handleLandingStats(socket);
  });
});

// Socket connection handling
namespace.on("connection", (socket) => {
  console.log("Client connected:", socket.id, "at", socket.nsp.name);

  // Setup event handlers with error catching
  const setupHandler = (event, handler) => {
    socket.on(event, (...args) => {
      try {
        handler(socket, ...args);
      } catch (error) {
        console.error(`Error handling ${event}:`, error);
        socket.emit("error", "Internal server error");
      }
    });
  };

  if (socket.recovered) {
    handleReconnect(socket);
    setupHandler("gameUpdate", handleGameAction);
    setupHandler("leave", handleLeaveGame);
    setupHandler("disconnect", handleDisconnect);
  } else {
    // Handle socket errors
    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });

    setupHandler("displayConnect", handleDisplayConnect);
    setupHandler("controlsConnect", handleControlsConnect);
    setupHandler("leave", handleLeaveGame);
    setupHandler("gameUpdate", handleGameAction);
    setupHandler("disconnect", handleDisconnect);
  }
});

// Handle server-wide socket.io errors
io.engine.on("connection_error", (error) => {
  console.error("Connection error:", error);
});

// Graceful shutdown
function gracefulShutdown(signal) {
  console.log(`${signal} received. Shutting down gracefully...`);
  clearDropInterval(null, true);

  io.close();

  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Start server
(async () => {
  try {
    await start();
    await loadScores();

    return new Promise((resolve, reject) => {
      server.on("error", (error) => {
        if (error.code === "EADDRINUSE") {
          console.error(`Port ${PORT} still in use, shutting down...`);
          process.exit(1);
        }
        reject(error);
      });

      server.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        resolve();
      });
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
})();
