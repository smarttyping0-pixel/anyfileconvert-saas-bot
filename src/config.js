require('dotenv').config();

module.exports = {
  botToken: process.env.BOT_TOKEN || '',
  webAppUrl: process.env.WEB_APP_URL || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  removeBgApiKey: process.env.REMOVE_BG_API_KEY || '',
  paymentProviderToken: process.env.PAYMENT_PROVIDER_TOKEN || '',
  adminIds: (process.env.ADMIN_IDS || '').split(',').map(id => id.trim()),
  freeDailyCredits: parseInt(process.env.FREE_DAILY_CREDITS || '10', 10),
  proMonthlyCredits: parseInt(process.env.PRO_MONTHLY_CREDITS || '500', 10),
};
