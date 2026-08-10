const { InlineKeyboard } = require('grammy');
const db = require('../services/database');
const config = require('../config');

/**
 * Handle /ref or Referral menu button
 */
async function handleReferral(ctx) {
  const userId = ctx.from.id;
  const user = db.getUser(userId, ctx.from.username);
  const botInfo = ctx.me || await ctx.api.getMe();
  const refLink = `https://t.me/${botInfo.username}?start=ref_${userId}`;

  const text = 
`🎁 *Referral Program - Earn Free Credits!*

Invite your friends to use the bot and earn bonus credits!

🔗 *Your Unique Referral Link:*
\`${refLink}\`

⭐ *Reward:* Earn **+5 Bonus Credits** for every friend who joins via your link!
👥 *Friends Invited:* ${user.referralsCount || 0} friends`;

  const keyboard = new InlineKeyboard()
    .url("📢 Share Link", `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent("Convert files, images, PDFs & videos instantly on Telegram!")}`).row()
    .text("🔙 Back to Main Menu", "cmd_start");

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

/**
 * Handle /daily or Daily Claim button
 */
async function handleDailyBonus(ctx) {
  const result = db.claimDailyBonus(ctx.from.id);

  if (!result.success) {
    return ctx.reply(`⏰ ${result.message}`, { parse_mode: 'Markdown' });
  }

  const text = 
`🎉 *Daily Bonus Claimed!*

You received **+${result.bonusAmount} Free Credits**!
⚡ *Total Credits:* ${result.totalCredits}

Come back tomorrow for another daily reward!`;

  await ctx.reply(text, { parse_mode: 'Markdown' });
}

/**
 * Handle /feedback <message>
 */
async function handleFeedback(ctx) {
  const text = ctx.match || ctx.message.text.replace(/^\/feedback\s*/, '');
  if (!text || text.trim() === '') {
    return ctx.reply("❌ Please provide feedback or a message after `/feedback`.\nExample:\n`/feedback Love the bot! Can you add MP4 to MP3 quality selector?`", { parse_mode: 'Markdown' });
  }

  // Notify admin if admin IDs are configured
  if (config.adminIds && config.adminIds.length > 0) {
    for (const adminId of config.adminIds) {
      if (adminId) {
        await ctx.api.sendMessage(
          adminId,
          `📬 *New User Feedback Received!*\n\n👤 *From:* @${ctx.from.username || ctx.from.first_name} (\`${ctx.from.id}\`)\n💬 *Message:* ${text}`,
          { parse_mode: 'Markdown' }
        ).catch(() => {});
      }
    }
  }

  await ctx.reply("✅ *Thank you for your feedback!* Our team has received your message.", { parse_mode: 'Markdown' });
}

module.exports = {
  handleReferral,
  handleDailyBonus,
  handleFeedback
};
