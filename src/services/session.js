// Simple in-memory session manager for user task selection state
const userState = {};

function setUserTask(userId, taskName) {
  userState[userId] = {
    task: taskName,
    timestamp: Date.now()
  };
}

function getUserTask(userId) {
  return userState[userId] ? userState[userId].task : null;
}

function clearUserTask(userId) {
  delete userState[userId];
}

module.exports = {
  setUserTask,
  getUserTask,
  clearUserTask
};
