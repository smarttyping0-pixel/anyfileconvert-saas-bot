const aiService = require('../services/ai');
const db = require('../services/database');

/**
 * Middleware or helper to verify and deduct user credits
 */
function checkAndDeduct(ctx, cost = 1) {
  const user = db.getUser(ctx.from.id, ctx.from.username);
  if (user.credits < cost) {
    ctx.reply(
      `🚫 *Insufficient Credits!*\n\nYou have ${user.credits} credits left. You need ${cost} credit(s) for this action.\n\nUse /upgrade to get unlimited or top-up credits!`,
      { parse_mode: 'Markdown' }
    );
    return false;
  }
  db.deductCredits(ctx.from.id, cost);
  return true;
}

async function handleAiCommand(ctx) {
  const prompt = ctx.match || ctx.message.text.replace(/^\/ai\s*/, '');
  if (!prompt || prompt.trim() === '') {
    return ctx.reply("❌ Please provide a prompt after `/ai`. Example:\n`/ai What are 5 business ideas for 2026?`", { parse_mode: 'Markdown' });
  }

  if (!checkAndDeduct(ctx, 1)) return;

  const statusMsg = await ctx.reply("🧠 *Thinking...*", { parse_mode: 'Markdown' });

  try {
    const answer = await aiService.generateAiText(prompt);
    await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, answer, { parse_mode: 'Markdown' }).catch(() => {
      // Fallback if markdown parsing fails due to unescaped special characters
      ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, answer);
    });
  } catch (err) {
    console.error(err);
    ctx.reply("❌ An error occurred while generating the response.");
  }
}

async function handleSummarizeCommand(ctx) {
  const text = ctx.match || ctx.message.text.replace(/^\/summarize\s*/, '');
  if (!text || text.trim() === '') {
    return ctx.reply("❌ Please provide text to summarize after `/summarize` or reply to a text message with `/summarize`.", { parse_mode: 'Markdown' });
  }

  if (!checkAndDeduct(ctx, 1)) return;

  const statusMsg = await ctx.reply("📝 *Summarizing content...*", { parse_mode: 'Markdown' });

  try {
    const summary = await aiService.summarizeText(text);
    await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, summary, { parse_mode: 'Markdown' }).catch(() => {
      ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, summary);
    });
  } catch (err) {
    console.error(err);
    ctx.reply("❌ An error occurred while summarizing.");
  }
}

async function handleCodeCommand(ctx) {
  const codeProblem = ctx.match || ctx.message.text.replace(/^\/code\s*/, '');
  if (!codeProblem || codeProblem.trim() === '') {
    return ctx.reply("❌ Please provide code or a problem after `/code`. Example:\n`/code Write a Python script for web scraping`", { parse_mode: 'Markdown' });
  }

  if (!checkAndDeduct(ctx, 1)) return;

  const statusMsg = await ctx.reply("💻 *Generating solution...*", { parse_mode: 'Markdown' });

  try {
    const codeResult = await aiService.generateCodeHelper(codeProblem);
    await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, codeResult, { parse_mode: 'Markdown' }).catch(() => {
      ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, codeResult);
    });
  } catch (err) {
    console.error(err);
    ctx.reply("❌ An error occurred while generating code.");
  }
}

module.exports = {
  handleAiCommand,
  handleSummarizeCommand,
  handleCodeCommand
};
