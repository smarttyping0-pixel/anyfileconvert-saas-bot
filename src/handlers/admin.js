const db = require('../services/database');
const config = require('../config');

function isAdmin(userId) {
  if (!config.adminIds || config.adminIds.length === 0) return true; // Default allow first user if no admin ID set
  return config.adminIds.includes(String(userId));
}

/**
 * Handle /broadcast <message>
 */
async function handleBroadcast(ctx) {
  if (!isAdmin(ctx.from.id)) {
    return ctx.reply("🚫 Unauthorized: Admin access required.");
  }

  const broadcastMsg = ctx.match || ctx.message.text.replace(/^\/broadcast\s*/, '');
  if (!broadcastMsg || broadcastMsg.trim() === '') {
    return ctx.reply("❌ Usage: `/broadcast Your message to all users`", { parse_mode: 'Markdown' });
  }

  const userIds = db.getAllUserIds();
  let successCount = 0;
  let failCount = 0;

  const statusMsg = await ctx.reply(`📢 *Sending broadcast to ${userIds.length} users...*`, { parse_mode: 'Markdown' });

  for (const uid of userIds) {
    try {
      await ctx.api.sendMessage(uid, `📢 *Announcement from Bot Admin:*\n\n${broadcastMsg}`, { parse_mode: 'Markdown' });
      successCount++;
    } catch (err) {
      failCount++;
    }
  }

  await ctx.api.editMessageText(
    ctx.chat.id,
    statusMsg.message_id,
    `✅ *Broadcast Complete!*\n\n🟢 *Successfully Sent:* ${successCount}\n🔴 *Failed / Blocked:* ${failCount}`,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Handle /stats
 */
async function handleStats(ctx) {
  if (!isAdmin(ctx.from.id)) {
    return ctx.reply("🚫 Unauthorized: Admin access required.");
  }

  const stats = db.getStats();

  const text = 
`📊 *Admin System Statistics*

👥 *Total Registered Users:* ${stats.totalUsers}
💳 *Total Completed Transactions:* ${stats.totalTransactions}
⚡ *Server Status:* Online 🟢`;

  await ctx.reply(text, { parse_mode: 'Markdown' });
}

module.exports = {
  handleBroadcast,
  handleStats
};
