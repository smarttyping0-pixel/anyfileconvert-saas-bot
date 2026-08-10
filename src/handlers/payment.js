const { InlineKeyboard } = require('grammy');
const db = require('../services/database');

/**
 * Upgrade menu presenting pricing plans
 */
async function handleUpgrade(ctx) {
  const text = 
`⚡ *AnyFileConvert Pro Upgrade Plans*

Top up your conversion credits for high-speed file conversions, HD background removal, and Video-to-MP3 downloads!

1️⃣ *Pro Starter Pack*
   • +100 Conversion Credits
   • Unlimited PDF, Image & Document Conversions
   • High-Speed Video to MP3 Conversion
   • Price: 50 Telegram Stars

2️⃣ *Pro Ultimate Pass*
   • +500 Conversion Credits + PRO Status
   • HD remove.bg Background Removal
   • Priority File Conversion Processing
   • Price: 200 Telegram Stars

Click below to purchase with Telegram Stars!`;

  const keyboard = new InlineKeyboard()
    .text("⭐ Buy Starter (50 Stars)", "buy_starter").row()
    .text("🚀 Buy Pro (200 Stars)", "buy_pro").row()
    .text("🔙 Back to Main Menu", "cmd_start");

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

/**
 * Send Telegram Invoice for Telegram Stars or Payment Provider
 */
async function sendInvoice(ctx, planType) {
  let title, description, payload, priceAmount;

  if (planType === 'starter') {
    title = "Pro Starter Pack (100 Conversion Credits)";
    description = "Adds 100 file conversion credits to your balance";
    payload = "payload_starter_100";
    priceAmount = 50; // Telegram Stars
  } else {
    title = "Pro Ultimate Pass (500 Conversion Credits)";
    description = "Adds 500 conversion credits & PRO status to your account";
    payload = "payload_pro_500";
    priceAmount = 200; // Telegram Stars
  }

  // Telegram Stars invoice configuration
  await ctx.replyWithInvoice(
    title,
    description,
    payload,
    "", // Provider token empty for Telegram Stars XTR currency
    "XTR",
    [{ label: title, amount: priceAmount }]
  ).catch(err => {
    console.error("Invoice error:", err);
    ctx.reply("❌ Unable to send invoice. Ensure Telegram Payment settings are active.");
  });
}

/**
 * Handle successful payment webhook
 */
async function handleSuccessfulPayment(ctx) {
  const payment = ctx.message.successful_payment;
  const payload = payment.invoice_payload;
  const userId = ctx.from.id;

  let addedCredits = 0;
  let plan = null;

  if (payload === 'payload_starter_100') {
    addedCredits = 100;
  } else if (payload === 'payload_pro_500') {
    addedCredits = 500;
    plan = 'pro';
  }

  db.addCredits(userId, addedCredits, plan);
  db.addTransaction(userId, payment.total_amount, payload, payment.telegram_payment_charge_id);

  await ctx.reply(
    `🎉 *Payment Successful!*\n\nThank you for your purchase. Added +${addedCredits} credits to your account!`,
    { parse_mode: 'Markdown' }
  );
}

module.exports = {
  handleUpgrade,
  sendInvoice,
  handleSuccessfulPayment
};
