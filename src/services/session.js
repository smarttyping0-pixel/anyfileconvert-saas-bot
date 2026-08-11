// In-memory session manager for user task selection state and parameters
const userState = {};

function setUserTask(userId, taskName, options = {}) {
  userState[userId] = {
    task: taskName,
    options: options,
    timestamp: Date.now()
  };
}

function getUserTask(userId) {
  return userState[userId] ? userState[userId].task : null;
}

function getUserOptions(userId) {
  return userState[userId] ? userState[userId].options || {} : {};
}

function clearUserTask(userId) {
  delete userState[userId];
}

module.exports = {
  setUserTask,
  getUserTask,
  getUserOptions,
  clearUserTask
};
