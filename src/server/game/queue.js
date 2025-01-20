let playerQueue = {};
let currentPlayer = {};
let displaySocket = {};

function addToQueue(id, playerId) {
  if (!playerQueue[id]) {
    playerQueue[id] = [];
  }

  if (!playerQueue[id].includes(playerId)) {
    playerQueue[id].push(playerId);
    return true;
  }
  return false;
}

function removeFromQueue(id, playerId) {
  const queueIndex = playerQueue[id]?.indexOf(playerId);
  if (queueIndex > -1) {
    playerQueue[id].splice(queueIndex, 1);
    return true;
  }
  return false;
}

function removePlayer(id, playerId) {
  // Remove from queue if present
  removeFromQueue(id, playerId);

  // If it's the current player, end their game
  if (playerId === currentPlayer[id]) {
    currentPlayer[id] = null;
    return true;
  }

  return false;
}

function getQueueStatus(id, playerId) {
  if (playerId === currentPlayer[id]) {
    return {
      position: 0,
      total: playerQueue[id]?.length || 0,
      isPlaying: true,
    };
  }

  const position = playerQueue[id]?.indexOf(playerId);
  if (position === -1 || (position !== 0 && !position)) {
    return null;
  }

  return {
    position: position + 1,
    total: playerQueue[id]?.length || 0,
    isPlaying: false,
  };
}

function getNextPlayer(id) {
  if (!currentPlayer[id] && playerQueue[id].length > 0) {
    currentPlayer[id] = playerQueue[id].shift();
    return currentPlayer[id];
  }
  return null;
}

function setDisplaySocket(id, socket) {
  displaySocket[id] = socket;
}

// TODO: there are more display sockets, find the one!
function getDisplaySocket(id) {
  return displaySocket[id];
}

// TODO: there are more display sockets, find the one!
function getCurrentPlayer(id) {
  return currentPlayer[id];
}

function clearCurrentPlayer(id) {
  currentPlayer[id] = null;
}

// function getQueueLength(id) {
//   return playerQueue[id]?.length || 0;
// }

function getAllQueueStatuses(id) {
  const statuses = [];

  // Add current player status if exists
  if (currentPlayer[id]) {
    statuses.push({
      playerId: currentPlayer[id],
      status: getQueueStatus(id, currentPlayer[id]),
    });
  }

  // Add status for each player in queue
  playerQueue[id]?.forEach((playerId) => {
    statuses.push({
      playerId,
      status: getQueueStatus(id, playerId),
    });
  });

  return statuses;
}

function getAllQueues() {
  return Object.keys(displaySocket)
    .filter((key) => !!displaySocket[key])
    .reduce((acc, id) => {
      const stats = getAllQueueStatuses(id);
      return [...acc, { id, stats }];
    }, []);
}

export {
  addToQueue,
  removePlayer,
  getNextPlayer,
  setDisplaySocket,
  getDisplaySocket,
  getCurrentPlayer,
  clearCurrentPlayer,
  // getQueueLength,
  getAllQueueStatuses,
  getAllQueues,
};
