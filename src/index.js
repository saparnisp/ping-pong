import http from "node:http";
import { Server } from "socket.io";
import { app, start } from "./server/host.js";
import { loadScores } from "./server/game/scores.js";
import {
  setup,
  cleanup,
  handleLandingStats,
} from "./server/socket/handlers.js";

// Create HTTP server
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";

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

// Setup all socket handlers
setup(io);

// Debug Socket.IO events
io.engine.on("connection_error", (err) => {
  console.log("Connection error:", err.req);
  console.log("Error code:", err.code);
  console.log("Error message:", err.message);
  console.log("Error context:", err.context);
});

// Handle server-wide socket.io errors
io.engine.on("connection_error", (error) => {
  console.error("Connection error:", error);
});

// Graceful shutdown
function gracefulShutdown(signal) {
  console.log(`${signal} received. Shutting down gracefully...`);

  // Cleanup all game loops and timers
  cleanup();

  io.close();

  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Global error handlers to prevent crash
process.on("uncaughtException", (error) => {
  console.error("❌ UNCAUGHT EXCEPTION:", error);
  // Keep process alive but maybe log critical error
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ UNHANDLED REJECTION:", reason);
});

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
