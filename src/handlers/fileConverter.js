const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { InlineKeyboard, InputFile } = require('grammy');
const mediaService = require('../services/mediaService');
const db = require('../services/database');
const session = require('../services/session');
const config = require('../config');

/**
 * Check if user has enough credits without deducting upfront
 */
function hasEnoughCredits(ctx, cost = 1) {
  const user = db.getUser(ctx.from.id, ctx.from.username);
  if (user.credits < cost) {
    ctx.reply(
      `🚫 *Insufficient Credits!*\n\nYou have ${user.credits} credit(s) left. You need ${cost} credit(s) to convert this file.\n\nUse /upgrade to buy credits or /daily to claim daily bonus!`,
      { parse_mode: 'Markdown' }
    );
    return false;
  }
  return true;
}

/**
 * Safely extract file_id from any Telegram message type
 */
function getTelegramFileId(ctx) {
  const msg = ctx.message;
  if (!msg) return null;

  if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
    return msg.photo[msg.photo.length - 1].file_id;
  }
  if (msg.document) return msg.document.file_id;
  if (msg.video) return msg.video.file_id;
  if (msg.video_note) return msg.video_note.file_id;
  if (msg.audio) return msg.audio.file_id;
  if (msg.voice) return msg.voice.file_id;
  if (msg.animation) return msg.animation.file_id;

  return null;
}

/**
 * Download file from Telegram API using HTTPS stream
 */
async function downloadTelegramFile(telegramFilePath, localDestinationPath) {
  const url = `https://api.telegram.org/file/bot${config.botToken}/${telegramFilePath}`;
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream'
  });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(localDestinationPath);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

/**
 * Menu Task Prompts & Handlers
 */
async function selectTask(ctx, taskType, promptText) {
  session.setUserTask(ctx.from.id, taskType);
  await ctx.reply(
    `✅ *Selected Task:* ${promptText}\n\n📥 *Please send or forward your file now to convert it!*`,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Handle incoming file uploads based on active menu selection
 */
async function handleIncomingFile(ctx) {
  const userId = ctx.from.id;
  let activeTask = session.getUserTask(userId);

  // Only override task if user has not explicitly selected a task from the menu
  if (!['fillbg', 'bgrem', 'imgconv', 'imgresize', 'imgcompress', 'v2gif', 'pdf2txt', 'docx2pdf', 'v2mp3', 'audconv'].includes(activeTask)) {
    if (ctx.message.photo) {
      activeTask = 'img2pdf';
    } else if (ctx.message.video || ctx.message.video_note) {
      activeTask = 'v2mp3';
    } else if (ctx.message.audio || ctx.message.voice) {
      activeTask = 'audconv';
    } else if (ctx.message.document) {
      const docName = (ctx.message.document.file_name || '').toLowerCase();
      if (docName.endsWith('.pdf')) activeTask = 'pdf2txt';
      else if (docName.endsWith('.docx')) activeTask = 'docx2pdf';
      else if (docName.endsWith('.txt')) activeTask = 'docx2pdf';
      else activeTask = 'img2pdf';
    }
  }

  const fileId = getTelegramFileId(ctx);
  if (!fileId) {
    return ctx.reply("❌ Unable to detect a valid file in your message. Please send a photo, document, video, or audio file.");
  }

  // Verify credit availability without deducting upfront
  if (!hasEnoughCredits(ctx, 1)) return;

  const statusMsg = await ctx.reply(`⏳ *Processing file for task: ${activeTask.toUpperCase()}...*`, { parse_mode: 'Markdown' });

  let fileObj;
  try {
    fileObj = await ctx.api.getFile(fileId);
  } catch (err) {
    console.error("ctx.api.getFile error:", err);
    return ctx.reply("❌ Error getting file details from Telegram API.");
  }

  const fileExt = path.extname(fileObj.file_path || '').toLowerCase() || '.jpg';
  const localInputPath = path.join(mediaService.TEMP_DIR, `in_${Date.now()}_${fileId.substring(0, 10)}${fileExt}`);
  let outputPath = null;

  try {
    await downloadTelegramFile(fileObj.file_path, localInputPath);

    // 1. Task: Video to MP3
    if (activeTask === 'v2mp3') {
      outputPath = await mediaService.convertMediaToAudio(localInputPath, 'mp3');
      db.deductCredits(userId, 1); // Deduct ONLY on success
      await ctx.replyWithAudio(new InputFile(outputPath), {
        caption: "🎵 *Converted Video to MP3 Audio!*",
        parse_mode: 'Markdown'
      });
    }
    // 2. Task: Video to GIF
    else if (activeTask === 'v2gif') {
      outputPath = await mediaService.convertVideoFormat(localInputPath, 'gif');
      db.deductCredits(userId, 1);
      await ctx.replyWithDocument(new InputFile(outputPath), {
        caption: "🎬 *Converted Video to Animated GIF!*",
        parse_mode: 'Markdown'
      });
    }
    // 3. Task: Image to PDF
    else if (activeTask === 'img2pdf') {
      outputPath = await mediaService.convertImageToPdf(localInputPath);
      db.deductCredits(userId, 1);
      await ctx.replyWithDocument(new InputFile(outputPath), {
        caption: "📄 *Converted Image to PDF Document!*",
        parse_mode: 'Markdown'
      });
    }
    // 4. Task: Remove Background
    else if (activeTask === 'bgrem') {
      outputPath = await mediaService.removeImageBackground(localInputPath, process.env.REMOVE_BG_API_KEY || '');
      db.deductCredits(userId, 1);
      await ctx.replyWithDocument(new InputFile(outputPath), {
        caption: "✂️ *Background Removed Image (PNG)!*",
        parse_mode: 'Markdown'
      });
    }
    // 5. Task: PDF & Image to Text (OCR)
    else if (activeTask === 'pdf2txt') {
      let extractedText = '';
      if (['.png', '.jpg', '.jpeg', '.webp'].includes(fileExt)) {
        extractedText = await mediaService.extractTextFromImage(localInputPath);
      } else {
        extractedText = await mediaService.convertPdfToText(localInputPath);
      }
      outputPath = path.join(mediaService.TEMP_DIR, `extracted_${Date.now()}.txt`);
      fs.writeFileSync(outputPath, extractedText, 'utf8');
      db.deductCredits(userId, 1);
      await ctx.replyWithDocument(new InputFile(outputPath), {
        caption: "📝 *Extracted Text Document (OCR)!*",
        parse_mode: 'Markdown'
      });
    }
    // 6. Task: DOCX & TXT to PDF
    else if (activeTask === 'docx2pdf') {
      let docxText = '';
      if (fileExt === '.docx') {
        docxText = await mediaService.convertDocxToText(localInputPath);
      } else {
        try {
          docxText = fs.readFileSync(localInputPath, 'utf8');
        } catch (e) {
          docxText = await mediaService.convertDocxToText(localInputPath);
        }
      }
      outputPath = await mediaService.convertTextToPdf(docxText);
      db.deductCredits(userId, 1);
      await ctx.replyWithDocument(new InputFile(outputPath), {
        caption: "📄 *Converted Text/DOCX to PDF!*",
        parse_mode: 'Markdown'
      });
    }
    // 7. Task: Convert PNG/JPG/WEBP
    else if (activeTask === 'imgconv') {
      outputPath = await mediaService.convertImageFormat(localInputPath, 'png');
      db.deductCredits(userId, 1);
      await ctx.replyWithDocument(new InputFile(outputPath), {
        caption: "🖼️ *Converted Image Format!*",
        parse_mode: 'Markdown'
      });
    }
    // 8. Task: Audio Format Converter
    else if (activeTask === 'audconv') {
      outputPath = await mediaService.convertMediaToAudio(localInputPath, 'mp3');
      db.deductCredits(userId, 1);
      await ctx.replyWithAudio(new InputFile(outputPath), {
        caption: "🎵 *Converted Audio File!*",
        parse_mode: 'Markdown'
      });
    }
    // 9. Task: Fill Transparent Background with White
    else if (activeTask === 'fillbg') {
      outputPath = await mediaService.fillTransparentBackground(localInputPath, '#ffffff');
      db.deductCredits(userId, 1);
      await ctx.replyWithDocument(new InputFile(outputPath), {
        caption: "⚪ *Replaced Transparent Background with Solid White!*",
        parse_mode: 'Markdown'
      });
    }
    // 10. Task: Resize Image (Pixels & Percentage)
    else if (activeTask === 'imgresize') {
      outputPath = await mediaService.resizeImage(localInputPath, 800, 600);
      db.deductCredits(userId, 1);
      await ctx.replyWithDocument(new InputFile(outputPath), {
        caption: "📐 *Resized Image (800x600 Pixels)!*",
        parse_mode: 'Markdown'
      });
    }
    // 11. Task: Compress / Minimize Photo Size (KB/MB)
    else if (activeTask === 'imgcompress') {
      outputPath = await mediaService.compressImageToTargetSize(localInputPath, 200);
      const stats = fs.statSync(outputPath);
      const sizeKb = Math.round(stats.size / 1024);
      db.deductCredits(userId, 1);
      await ctx.replyWithDocument(new InputFile(outputPath), {
        caption: `📉 *Compressed Photo File Size (${sizeKb} KB)!*`,
        parse_mode: 'Markdown'
      });
    }

    session.clearUserTask(userId);
    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
  } catch (err) {
    console.error("Task execution error detailed:", err);
    ctx.reply(`❌ Error processing file: ${err.message || "Unknown error"}\n\n✨ *No credits were deducted.*`);
  } finally {
    mediaService.cleanupFile(localInputPath);
    if (outputPath) mediaService.cleanupFile(outputPath);
  }
}

/**
 * Handle video URL conversion (YouTube, Web video links)
 */
async function handleUrlConversion(ctx, videoUrl) {
  if (!hasEnoughCredits(ctx, 1)) return;

  const statusMsg = await ctx.reply("📥 *Downloading video from URL & converting to MP3 audio...*", { parse_mode: 'Markdown' });
  let outputPath = null;

  try {
    outputPath = await mediaService.downloadUrlToMp3(videoUrl);
    db.deductCredits(ctx.from.id, 1); // Deduct ONLY on success
    await ctx.replyWithAudio(new InputFile(outputPath), {
      caption: "🎵 *Here is your converted MP3 Audio from URL!*",
      parse_mode: 'Markdown'
    });
    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
  } catch (err) {
    console.error("URL conversion error:", err);
    ctx.reply(`❌ Failed to convert video from URL: ${err.message || "Invalid or inaccessible URL"}\n\n✨ *No credits were deducted.*`);
  } finally {
    if (outputPath) mediaService.cleanupFile(outputPath);
  }
}

module.exports = {
  selectTask,
  handleIncomingFile,
  handleUrlConversion
};
