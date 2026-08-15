const { Bot } = require('grammy');
const config = require('./config');
const { handleStart, handleProfile, handleLanguagePrompt } = require('./handlers/start');
const { selectTask, handleIncomingFile } = require('./handlers/fileConverter');
const { handleUpgrade, sendInvoice, handleSuccessfulPayment } = require('./handlers/payment');
const { handleReferral, handleDailyBonus, handleFeedback } = require('./handlers/userFeatures');
const { handleBroadcast, handleStats } = require('./handlers/admin');
const db = require('./services/database');
const session = require('./services/session');
const i18n = require('./services/i18n');

if (!config.botToken) {
  console.error("❌ BOT_TOKEN is missing in environment variables! Please check your .env file.");
  process.exit(1);
}

const bot = new Bot(config.botToken);

// -------------------------------------------------------------
// COMMAND REGISTRATION
// -------------------------------------------------------------
bot.command('start', async (ctx) => {
  const text = ctx.match || '';
  // Check if start command contains referral parameter (e.g. ref_123456)
  if (text.startsWith('ref_')) {
    const referrerId = text.replace('ref_', '').trim();
    if (referrerId) {
      const rewarded = db.processReferral(referrerId, ctx.from.id);
      if (rewarded) {
        await ctx.api.sendMessage(
          referrerId,
          `🎉 *New Referral Bonus!*\nA friend joined using your link! You received **+5 Bonus Credits**!`,
          { parse_mode: 'Markdown' }
        ).catch(() => {});
      }
    }
  }

  return handleStart(ctx);
});

bot.command('profile', handleProfile);
bot.command('upgrade', handleUpgrade);
bot.command('ref', handleReferral);
bot.command('referral', handleReferral);
bot.command('daily', handleDailyBonus);
bot.command('feedback', handleFeedback);
bot.command('language', handleLanguagePrompt);
bot.command('lang', handleLanguagePrompt);
bot.command('broadcast', handleBroadcast);
bot.command('stats', handleStats);

bot.command('help', async (ctx) => {
  const helpText = 
`📖 *Bot Commands & Feature Guide*

• /start - Open main menu & tool selector
• /daily - Claim your daily credit bonus (+3 credits)
• /ref - Get your referral link & earn +5 credits per friend
• /profile - View your account balance & plan
• /upgrade - Purchase extra credits via Telegram Stars
• /feedback <msg> - Send feedback or feature requests

*Admin Commands:*
• /broadcast <msg> - Broadcast announcement to all users
• /stats - View server system statistics`;
  await ctx.reply(helpText, { parse_mode: 'Markdown' });
});

// -------------------------------------------------------------
// INTERACTIVE MENU TASK SELECTION BUTTONS
// -------------------------------------------------------------
bot.callbackQuery('task_url2mp3', async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  await ctx.reply("🔗 *URL to MP3:* Paste any video link (YouTube, Web video, MP4 URL) to convert to MP3!", { parse_mode: 'Markdown' });
});

bot.callbackQuery('task_v2mp3', async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  return selectTask(ctx, 'v2mp3', '🎥 Video to MP3 Audio');
});

bot.callbackQuery('task_v2gif', async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  return selectTask(ctx, 'v2gif', '🎬 Video to Animated GIF');
});

bot.callbackQuery('task_img2pdf', async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  return selectTask(ctx, 'img2pdf', '📄 Image to PDF Document');
});

bot.callbackQuery('task_bgrem', async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  return selectTask(ctx, 'bgrem', '✂️ Remove Image Background');
});

bot.callbackQuery('task_fillbg', async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  return selectTask(ctx, 'fillbg', '⚪ Fill Transparent Background with White');
});

bot.callbackQuery('task_imgresize', async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const { promptResizeOptions } = require('./handlers/fileConverter');
  return promptResizeOptions(ctx);
});

bot.callbackQuery('task_imgcompress', async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const { promptCompressOptions } = require('./handlers/fileConverter');
  return promptCompressOptions(ctx);
});

// Dedicated Custom Callbacks
bot.callbackQuery('resize_custom', async (ctx) => {
  await ctx.answerCallbackQuery("✍️ Type custom dimensions below!").catch(() => {});
  session.setUserTask(ctx.from.id, 'imgresize', {});
  await ctx.reply(
    "✍️ *HOW TO TYPE CUSTOM IMAGE DIMENSIONS:*\n\n" +
    "1️⃣ **Step 1:** Type your custom size in the Telegram message box below:\n" +
    "   • **For Width x Height (Pixels):** Type `1200x800` or `1080x1080`\n" +
    "   • **For Percentage Scale:** Type `50%` or `75%`\n\n" +
    "2️⃣ **Step 2:** Press **Send**.\n\n" +
    "3️⃣ **Step 3:** Send or upload your photo!\n\n" +
    "👇 *Type your custom size in the chat below now:*",
    { parse_mode: 'Markdown' }
  );
});

bot.callbackQuery('compress_custom', async (ctx) => {
  await ctx.answerCallbackQuery("✍️ Type target size limit below!").catch(() => {});
  session.setUserTask(ctx.from.id, 'imgcompress', {});
  await ctx.reply(
    "✍️ *HOW TO TYPE CUSTOM FILE SIZE LIMIT:*\n\n" +
    "1️⃣ **Step 1:** Type your target maximum file size in the Telegram message box below:\n" +
    "   • **For KB Limit:** Type `150kb` or `300kb`\n" +
    "   • **For MB Limit:** Type `2mb` or `5mb`\n\n" +
    "2️⃣ **Step 2:** Press **Send**.\n\n" +
    "3️⃣ **Step 3:** Send or upload your photo!\n\n" +
    "👇 *Type your target file size limit in the chat below now:*",
    { parse_mode: 'Markdown' }
  );
});

// Resize Presets
bot.callbackQuery(/^resize_(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const val = ctx.match[1];
  if (val.startsWith('pct_')) {
    const pct = parseInt(val.replace('pct_', ''), 10);
    session.setUserTask(ctx.from.id, 'imgresize', { percentage: pct });
    await ctx.reply(`✅ *Resize Mode Set:* ${pct}% Scale!\n\n📥 *Send your photo now!*`, { parse_mode: 'Markdown' });
  } else {
    const parts = val.split('x');
    const w = parseInt(parts[0], 10);
    const h = parseInt(parts[1], 10);
    session.setUserTask(ctx.from.id, 'imgresize', { width: w, height: h });
    await ctx.reply(`✅ *Resize Mode Set:* ${w} x ${h} pixels!\n\n📥 *Send your photo now!*`, { parse_mode: 'Markdown' });
  }
});

// Compress Presets
bot.callbackQuery(/^compress_(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const kb = parseInt(ctx.match[1], 10);
  session.setUserTask(ctx.from.id, 'imgcompress', { targetKb: kb });
  await ctx.reply(`✅ *Compress Limit Set:* Maximum ${kb} KB!\n\n📥 *Send your photo now!*`, { parse_mode: 'Markdown' });
});

bot.callbackQuery('task_pdf2txt', async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  return selectTask(ctx, 'pdf2txt', '📝 PDF to Text File (.txt)');
});

bot.callbackQuery('task_docx2pdf', async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  return selectTask(ctx, 'docx2pdf', '📘 Word DOCX to PDF Document');
});

bot.callbackQuery('task_imgconv', async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  return selectTask(ctx, 'imgconv', '🖼️ Convert Image (PNG/JPG/WEBP)');
});

// User Feature Callback Queries
bot.callbackQuery('cmd_daily', async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  return handleDailyBonus(ctx);
});

bot.callbackQuery('cmd_ref', async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  return handleReferral(ctx);
});

bot.callbackQuery('cmd_start', async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  return handleStart(ctx);
});

bot.callbackQuery('cmd_profile', async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  return handleProfile(ctx);
});

bot.callbackQuery('cmd_upgrade', async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  return handleUpgrade(ctx);
});

bot.callbackQuery('buy_starter', async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  return sendInvoice(ctx, 'starter');
});

bot.callbackQuery('buy_pro', async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  return sendInvoice(ctx, 'pro');
});

// -------------------------------------------------------------
// BOTTOM CHAT KEYBOARD TEXT LISTENERS
// -------------------------------------------------------------
bot.hears("🔗 URL to MP3", async (ctx) => {
  await ctx.reply("🔗 *URL to MP3:* Paste any video link (YouTube, Web video, MP4 URL) to convert to MP3!", { parse_mode: 'Markdown' });
});
bot.hears("🎥 Video to MP3", (ctx) => selectTask(ctx, 'v2mp3', '🎥 Video to MP3 Audio'));
bot.hears("🎬 Video to GIF", (ctx) => selectTask(ctx, 'v2gif', '🎬 Video to Animated GIF'));
bot.hears("📄 Image to PDF", (ctx) => selectTask(ctx, 'img2pdf', '📄 Image to PDF Document'));
bot.hears(["✂️ Make BG Transparent", "✂️ Remove BG"], (ctx) => selectTask(ctx, 'bgrem', '✂️ Make BG Transparent (PNG format)'));
bot.hears("📐 Resize Image", (ctx) => {
  const { promptResizeOptions } = require('./handlers/fileConverter');
  return promptResizeOptions(ctx);
});
bot.hears("📉 Compress Photo", (ctx) => {
  const { promptCompressOptions } = require('./handlers/fileConverter');
  return promptCompressOptions(ctx);
});
bot.hears("📝 PDF to Text", (ctx) => selectTask(ctx, 'pdf2txt', '📝 PDF to Text File (.txt)'));
bot.hears("📘 DOCX to PDF", (ctx) => selectTask(ctx, 'docx2pdf', '📘 Word DOCX to PDF Document'));
bot.hears("🖼️ Convert PNG/JPG", (ctx) => selectTask(ctx, 'imgconv', '🖼️ Convert Image (PNG/JPG/WEBP)'));
bot.hears("🎁 Daily Bonus", handleDailyBonus);
bot.hears("👥 Refer & Earn", handleReferral);
bot.hears("⭐ Buy Credits", handleUpgrade);
bot.hears("👤 My Account", handleProfile);
bot.hears(["🌐 Language", "🌐 Change Language"], handleLanguagePrompt);

// Language Callback Query Handler
bot.callbackQuery(/^lang_(.+)$/, async (ctx) => {
  const langCode = ctx.match[1];
  i18n.setUserLanguage(ctx.from.id, langCode);
  const langNames = {
    en: "English 🇺🇸",
    es: "Español 🇪🇸",
    hi: "हिन्दी 🇮🇳",
    ar: "العربية 🇸🇦",
    ru: "Русский 🇷🇺",
    pt: "Português 🇧🇷",
    fr: "Français 🇫🇷"
  };
  const selectedName = langNames[langCode] || langCode;
  await ctx.answerCallbackQuery(`✅ Language set to ${selectedName}!`).catch(() => {});
  await ctx.reply(
    `🌐 *Language Updated:* Your language is now set to **${selectedName}**!\n\n` +
    `All bot messages will now be sent in your preferred language.`,
    { parse_mode: 'Markdown' }
  );
  return handleStart(ctx);
});

// -------------------------------------------------------------
// MEDIA & FILE UPLOAD LISTENERS (Routed by Session Selection)
// -------------------------------------------------------------
bot.on([':video', ':video_note', ':photo', ':document', ':audio', ':voice'], handleIncomingFile);

// -------------------------------------------------------------
// PRE-CHECKOUT & PAYMENT LISTENERS
// -------------------------------------------------------------
bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));
bot.on(':successful_payment', handleSuccessfulPayment);

// Fallback message & URL link detection
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text.trim();
  if (text.startsWith('/')) return;

  if (text.startsWith('http://') || text.startsWith('https://')) {
    const { handleUrlConversion } = require('./handlers/fileConverter');
    return handleUrlConversion(ctx, text);
  }

  const activeTask = session.getUserTask(ctx.from.id);

  if (activeTask === 'imgresize') {
    const pctMatch = text.match(/(\d+)\s*%/);
    if (pctMatch) {
      const pct = parseInt(pctMatch[1], 10);
      session.setUserTask(ctx.from.id, 'imgresize', { percentage: pct });
      return ctx.reply(`✅ *Custom Scale Set:* ${pct}% Scale!\n\n📥 *Now send or upload your photo to resize!*`, { parse_mode: 'Markdown' });
    }

    const dimMatch = text.match(/(\d+)\s*[*x,:\s]\s*(\d+)/i);
    if (dimMatch) {
      const w = parseInt(dimMatch[1], 10);
      const h = parseInt(dimMatch[2], 10);
      session.setUserTask(ctx.from.id, 'imgresize', { width: w, height: h });
      return ctx.reply(`✅ *Custom Dimensions Set:* ${w} x ${h} pixels!\n\n📥 *Now send or upload your photo to resize!*`, { parse_mode: 'Markdown' });
    }
  }

  if (activeTask === 'imgcompress') {
    const match = text.match(/(\d+)\s*(kb|mb)?/i);
    if (match) {
      let kb = parseInt(match[1], 10);
      const unit = (match[2] || 'kb').toLowerCase();
      if (unit === 'mb') kb = kb * 1024;
      session.setUserTask(ctx.from.id, 'imgcompress', { targetKb: kb });
      return ctx.reply(`✅ *Custom Target Size Set:* Maximum ${kb} KB!\n\n📥 *Now send or upload your photo to compress!*`, { parse_mode: 'Markdown' });
    }
  }

  if (activeTask === 'docx2pdf') {
    const { hasEnoughCredits } = require('./handlers/fileConverter');
    if (!hasEnoughCredits(ctx, 1)) return;
    const statusMsg = await ctx.reply("⏳ *Converting your text message into a PDF document...*", { parse_mode: 'Markdown' });
    try {
      const mediaService = require('./services/mediaService');
      const { InputFile } = require('grammy');
      const outputPath = await mediaService.convertTextToPdf(text);
      db.deductCredits(ctx.from.id, 1);
      await ctx.replyWithDocument(new InputFile(outputPath), {
        caption: "📄 *Here is your converted PDF Document!*",
        parse_mode: 'Markdown'
      });
      session.clearUserTask(ctx.from.id);
      await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
      if (outputPath) mediaService.cleanupFile(outputPath);
    } catch (e) {
      console.error("Text message to PDF error:", e);
      ctx.reply(`❌ Failed to convert text to PDF: ${e.message}`);
    }
    return;
  }

  await ctx.reply(
    "📥 *Send a file or URL link to convert:*\n\n🔗 **Paste any Video URL**\n📄 **PDF / DOCX / TXT**\n🖼️ **PNG / JPG / WEBP**\n🎥 **Video / Video Note**",
    { parse_mode: 'Markdown' }
  );
});

// Catch errors gracefully
bot.catch((err) => {
  console.error("Bot Error Handler caught an error:", err);
});

// Set Persistent Left-Side Chat Menu Button
const webAppUrl = config.webAppUrl || process.env.WEB_APP_URL || '';
if (webAppUrl && webAppUrl.startsWith('https://')) {
  bot.api.setChatMenuButton({
    menu_button: {
      type: 'web_app',
      text: '⚡ Open Mini App',
      web_app: { url: webAppUrl }
    }
  }).catch(() => {});
} else {
  bot.api.setChatMenuButton({
    menu_button: { type: 'commands' }
  }).catch(() => {});
}

// Start Express WebApp Server for Telegram Mini App
const { startServer } = require('./server');
startServer();

// Start Telegram Bot with automatic 409 Conflict reconnect recovery
console.log("⚡ All-in-One Format Converter & Telegram Mini App Bot is running...");
bot.start({
  onStart: (botInfo) => {
    console.log(`🤖 Bot @${botInfo.username} started long-polling updates!`);
  }
}).catch((err) => {
  if (err && (err.error_code === 409 || (err.message && err.message.includes('409')))) {
    console.warn("⚠️ 409 Conflict detected during container restart. Retrying long-polling in 5s...");
    setTimeout(() => bot.start().catch(() => {}), 5000);
  } else {
    console.error("Bot start error:", err);
  }
});
