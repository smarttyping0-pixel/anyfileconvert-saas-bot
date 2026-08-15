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

  const showMiniApp = process.env.SHOW_MINI_APP === 'true';
  const webAppUrl = config.webAppUrl || process.env.WEB_APP_URL || '';
  const inlineKeyboard = new InlineKeyboard();

  if (showMiniApp && webAppUrl && webAppUrl.startsWith('https://')) {
    inlineKeyboard.webApp("🚀 Launch AnyFileConvert Web App", webAppUrl).row();
  }

  inlineKeyboard
    .text("🎥 Video to MP3", "task_v2mp3")
    .text("🎬 Video to GIF", "task_v2gif").row()
    .text("📄 Image to PDF", "task_img2pdf")
    .text("✂️ Make BG Transparent", "task_bgrem").row()
    .text("📐 Resize Image", "task_imgresize")
    .text("📉 Compress Photo", "task_imgcompress").row()
    .text("📝 PDF to Text", "task_pdf2txt")
    .text("📘 DOCX to PDF", "task_docx2pdf").row()
    .text("🖼️ Convert PNG/JPG", "task_imgconv").row()
    .text("🎁 Daily Bonus", "cmd_daily")
    .text("👥 Refer & Earn", "cmd_ref").row()
    .text("⭐ Buy Credits", "cmd_upgrade")
    .text("👤 My Account", "cmd_profile");

  const bottomChatKeyboard = new Keyboard();
  if (showMiniApp && webAppUrl && webAppUrl.startsWith('https://')) {
    bottomChatKeyboard.webApp("🚀 Open Mini App", webAppUrl).row();
  }

  bottomChatKeyboard
    .text("🎥 Video to MP3").text("🎬 Video to GIF").row()
    .text("📄 Image to PDF").text("✂️ Make BG Transparent").row()
    .text("📐 Resize Image").text("📉 Compress Photo").row()
    .text("📝 PDF to Text").text("📘 DOCX to PDF").row()
    .text("🖼️ Convert PNG/JPG").text("🎁 Daily Bonus").row()
    .text("👥 Refer & Earn").text("⭐ Buy Credits").row()
    .text("👤 My Account").text("🌐 Language").resized();

  await ctx.reply(welcomeText, {
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard
  });

  await ctx.reply("👇 *Quick Chat Keyboard:*", {
    parse_mode: 'Markdown',
    reply_markup: bottomChatKeyboard
  });
}

async function handleLanguagePrompt(ctx) {
  const keyboard = new InlineKeyboard()
    .text("🇺🇸 English", "lang_en")
    .text("🇪🇸 Español", "lang_es").row()
    .text("🇮🇳 हिन्दी", "lang_hi")
    .text("🇸🇦 العربية", "lang_ar").row()
    .text("🇷🇺 Русский", "lang_ru")
    .text("🇧🇷 Português", "lang_pt").row()
    .text("🇫🇷 Français", "lang_fr");

  await ctx.reply(
    "🌐 *Select Your Preferred Language / Elige tu idioma:*\n\n" +
    "Choose your language from the options below:",
    { parse_mode: 'Markdown', reply_markup: keyboard }
  );
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
  handleProfile,
  handleLanguagePrompt
};
