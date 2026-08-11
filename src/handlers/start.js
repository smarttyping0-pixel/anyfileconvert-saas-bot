const { InlineKeyboard, Keyboard } = require('grammy');
const db = require('../services/database');

async function handleStart(ctx) {
  const user = db.getUser(ctx.from.id, ctx.from.username);
  
  const welcomeText = 
`⚡ *Welcome to Universal Format Converter Bot!*

Convert any file format instantly inside Telegram!

*Your Account:*
⭐ *Plan:* ${user.plan.toUpperCase()}
⚡ *Free Daily Credits:* ${user.credits} remaining

👇 *Choose a conversion task from the menu below:*`;

  const webAppUrl = process.env.WEB_APP_URL || 'https://anyfileconvert-saas-bot.onrender.com';
  const inlineKeyboard = new InlineKeyboard();

  if (webAppUrl && webAppUrl.startsWith('https://')) {
    inlineKeyboard.webApp("🚀 Launch AnyFileConvert Web App", webAppUrl).row();
  }

  inlineKeyboard
    .text("🔗 URL to MP3", "task_url2mp3")
    .text("🎥 Video to MP3", "task_v2mp3").row()
    .text("🎬 Video to GIF", "task_v2gif")
    .text("📄 Image to PDF", "task_img2pdf").row()
    .text("✂️ Remove BG", "task_bgrem")
    .text("⚪ Fill Transparent BG", "task_fillbg").row()
    .text("📝 PDF to Text", "task_pdf2txt")
    .text("📘 DOCX to PDF", "task_docx2pdf").row()
    .text("🖼️ Convert PNG/JPG", "task_imgconv")
    .text("🎁 Daily Bonus", "cmd_daily").row()
    .text("👥 Refer & Earn", "cmd_ref")
    .text("⭐ Buy Credits", "cmd_upgrade").row()
    .text("👤 My Account", "cmd_profile");

  const bottomChatKeyboard = new Keyboard()
    .text("🔗 URL to MP3").text("🎥 Video to MP3").row()
    .text("📄 Image to PDF").text("✂️ Remove BG").row()
    .text("⚪ Fill Transparent BG").text("📝 PDF to Text").row()
    .text("📘 DOCX to PDF").text("🖼️ Convert PNG/JPG").row()
    .text("🎁 Daily Bonus").text("👥 Refer & Earn").row()
    .text("⭐ Buy Credits").text("👤 My Account").resized();

  await ctx.reply(welcomeText, {
    parse_mode: 'Markdown',
    reply_markup: bottomChatKeyboard
  });
}

async function handleProfile(ctx) {
  const user = db.getUser(ctx.from.id, ctx.from.username);

  const profileText = 
`👤 *User Account Profile*

🆔 *ID:* \`${user.id}\`
👤 *Username:* @${user.username || 'N/A'}
⭐ *Plan:* ${user.plan.toUpperCase()}
⚡ *Credits Remaining:* ${user.credits}
👥 *Friends Referred:* ${user.referralsCount || 0}
📅 *Last Daily Reset:* ${user.lastReset}`;

  const keyboard = new InlineKeyboard()
    .text("🎁 Claim Daily Bonus", "cmd_daily")
    .text("👥 Invite Friends", "cmd_ref").row()
    .text("💳 Top Up Credits", "cmd_upgrade")
    .text("🔄 Refresh", "cmd_profile");

  await ctx.reply(profileText, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

module.exports = {
  handleStart,
  handleProfile
};
