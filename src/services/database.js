const fs = require('fs');
const path = require('path');

const config = require('../config');

const DB_PATH = path.join(__dirname, '../../db.json');

const defaultData = {
  users: {},
  transactions: [],
  referrals: {}
};

function loadDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading database file, resetting:", err);
    return defaultData;
  }
}

function saveDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function isUserAdmin(userId) {
  const adminList = (config.adminIds || []).map(id => String(id).trim());
  return adminList.includes(String(userId).trim());
}

function getUser(userId, username = '', langCode = 'en') {
  const db = loadDb();
  const today = new Date().toISOString().split('T')[0];
  const admin = isUserAdmin(userId);
  const cleanLang = (langCode || 'en').toLowerCase().split('-')[0];

  if (!db.users[userId]) {
    db.users[userId] = {
      id: userId,
      username: username,
      plan: admin ? 'admin' : 'free',
      credits: admin ? 999999 : 10,
      lastReset: today,
      lastDailyClaim: '',
      referralsCount: 0,
      language: cleanLang,
      createdAt: new Date().toISOString()
    };
    saveDb(db);
  } else {
    const user = db.users[userId];
    if (username && user.username !== username) {
      user.username = username;
    }
    if (!user.language) {
      user.language = cleanLang;
      saveDb(db);
    }
    if (admin) {
      user.plan = 'admin';
      user.credits = 999999;
      saveDb(db);
    } else if (user.plan === 'free' && user.lastReset !== today) {
      user.credits = 10;
      user.lastReset = today;
      saveDb(db);
    }
  }

  return db.users[userId];
}

function deductCredits(userId, amount = 1) {
  const db = loadDb();
  if (!db.users[userId]) {
    getUser(userId);
    return deductCredits(userId, amount);
  }
  const user = db.users[userId];
  if (user.plan === 'admin' || isUserAdmin(userId)) {
    user.credits = 999999;
    return 999999;
  }
  user.credits = Math.max(0, user.credits - amount);
  saveDb(db);
  return user.credits;
}

function addCredits(userId, amount, plan = null) {
  const db = loadDb();
  if (!db.users[userId]) {
    getUser(userId);
    return addCredits(userId, amount, plan);
  }
  const user = db.users[userId];
  user.credits += amount;
  if (plan) user.plan = plan;
  saveDb(db);
  return user;
}

function claimDailyBonus(userId) {
  const db = loadDb();
  const today = new Date().toISOString().split('T')[0];

  if (!db.users[userId]) {
    getUser(userId);
    return claimDailyBonus(userId);
  }

  const user = db.users[userId];
  if (user.lastDailyClaim === today) {
    return { success: false, message: "You have already claimed today's bonus! Come back tomorrow." };
  }

  user.credits += 3;
  user.lastDailyClaim = today;
  saveDb(db);

  return { success: true, bonusAmount: 3, totalCredits: user.credits };
}

function processReferral(referrerId, newUserId) {
  const db = loadDb();

  if (String(referrerId) === String(newUserId)) return false;
  if (!db.users[referrerId]) return false;

  if (!db.referrals[referrerId]) {
    db.referrals[referrerId] = [];
  }

  if (!db.referrals[referrerId].includes(newUserId)) {
    db.referrals[referrerId].push(newUserId);
    db.users[referrerId].credits += 5;
    db.users[referrerId].referralsCount = (db.users[referrerId].referralsCount || 0) + 1;
    saveDb(db);
    return true;
  }

  return false;
}

function addTransaction(userId, amount, type, providerPaymentId) {
  const db = loadDb();
  if (!db.transactions) db.transactions = [];
  db.transactions.push({
    userId,
    amount,
    type,
    providerPaymentId,
    timestamp: new Date().toISOString()
  });
  saveDb(db);
}

function getAllUserIds() {
  const db = loadDb();
  return Object.keys(db.users);
}

function getStats() {
  const db = loadDb();
  const userIds = Object.keys(db.users);
  const totalUsers = userIds.length;
  const totalTransactions = (db.transactions || []).length;

  return {
    totalUsers,
    totalTransactions
  };
}

module.exports = {
  getUser,
  deductCredits,
  addCredits,
  claimDailyBonus,
  processReferral,
  addTransaction,
  getAllUserIds,
  getStats
};
