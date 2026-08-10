const { Bot } = require('grammy');
const config = require('./config');
const { handleStart, handleProfile } = require('./handlers/start');
const { selectTask, handleIncomingFile } = require('./handlers/fileConverter');
const { handleUpgrade, sendInvoice, handleSuccessfulPayment } = require('./handlers/payment');
const { handleReferral, handleDailyBonus, handleFeedback } = require('./handlers/userFeatures');
const { handleBroadcast, handleStats } = require('./handlers/admin');
const db = require('./services/database');

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
bot.hears("✂️ Remove BG", (ctx) => selectTask(ctx, 'bgrem', '✂️ Remove Image Background'));
bot.hears("⚪ Fill Transparent BG", (ctx) => selectTask(ctx, 'fillbg', '⚪ Fill Transparent Background with White'));
bot.hears("📝 PDF to Text", (ctx) => selectTask(ctx, 'pdf2txt', '📝 PDF to Text File (.txt)'));
bot.hears("📘 DOCX to PDF", (ctx) => selectTask(ctx, 'docx2pdf', '📘 Word DOCX to PDF Document'));
bot.hears("🖼️ Convert PNG/JPG", (ctx) => selectTask(ctx, 'imgconv', '🖼️ Convert Image (PNG/JPG/WEBP)'));
bot.hears("🎁 Daily Bonus", handleDailyBonus);
bot.hears("👥 Refer & Earn", handleReferral);
bot.hears("⭐ Buy Credits", handleUpgrade);
bot.hears("👤 My Account", handleProfile);

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
bot.api.setChatMenuButton({
  menu_button: { type: 'commands' }
}).catch(() => {});

// Start Express WebApp Server for Telegram Mini App
const { startServer } = require('./server');
startServer();

// Start Telegram Bot
console.log("⚡ All-in-One Format Converter & Telegram Mini App Bot is running...");
bot.start();
