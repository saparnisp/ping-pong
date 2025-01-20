import { ControllerDisplay } from "./controllerDisplay.js";
import { GameControls } from "./controls.js";
import { SocketHandler } from "./events.js";

const getId = () => {
  let params = new URLSearchParams(document.location.search);
  let id = params.get("id");

  return id;
};

document.addEventListener("DOMContentLoaded", () => {
  const id = getId();
  document.getElementById("screen-id").innerHTML = id;
  if (!id) {
    // TODO: Ask server for the next id?
    console.error("No display ID found in URL!");
    return;
  }

  // Initialize game components
  const socket = io(`/display_${id}`, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
  });

  socket.on("connect", () => {
    if (socket.recovered) {
      console.log("reconnected!");
    } else {
      socket.emit("controlsConnect");
    }
  });

  socket.on("gameConfig", (config) => {
    const display = new ControllerDisplay(
      config.COLORS,
      config.DEFAULT_BLOCK_SIZE,
      config.SCREEN_SIZE
    );
    const controls = new GameControls(socket);
    controls.setupControlEvents();
    const socketHandler = new SocketHandler(display, controls, socket); // Pass both display and controls

    const canvas = document.getElementById("gameBoard");
    canvas.width = config.SCREEN_SIZE.cols * config.DEFAULT_BLOCK_SIZE;
    canvas.height = config.SCREEN_SIZE.rows * config.DEFAULT_BLOCK_SIZE;
    canvas?.focus();

    // Connect to server as controls
    // socketHandler.connectAsControls();
  });
});
