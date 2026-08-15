const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const pdfParse = require('pdf-parse');
const sharp = require('sharp');
const axios = require('axios');
const FormData = require('form-data');
const mammoth = require('mammoth');
const config = require('../config');

ffmpeg.setFfmpegPath(ffmpegPath);

// Disable Sharp internal image memory cache for 512MB RAM cloud hosting
sharp.cache(false);
sharp.concurrency(1);

const TEMP_DIR = path.join(__dirname, '../../temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// -------------------------------------------------------------------
// 1. VIDEO & AUDIO CONVERTERS (FFmpeg)
// -------------------------------------------------------------------

/**
 * Convert any Media (Video/Audio) to target audio format (mp3, wav, aac, ogg)
 */
function convertMediaToAudio(inputFilePath, targetFormat = 'mp3') {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    const outputFilePath = path.join(TEMP_DIR, `audio_${Date.now()}.${targetFormat}`);
    const resolvedInput = path.resolve(inputFilePath);
    const resolvedOutput = path.resolve(outputFilePath);

    let command = ffmpeg(resolvedInput).noVideo();

    if (targetFormat === 'mp3') {
      command = command.audioCodec('libmp3lame').audioBitrate('192k');
    } else if (targetFormat === 'aac') {
      command = command.audioCodec('aac');
    } else {
      command = command.toFormat(targetFormat);
    }

    command
      .on('end', () => resolve(resolvedOutput))
      .on('error', (err) => {
        console.error(`FFmpeg Audio Error (${targetFormat}):`, err.message);
        reject(err);
      })
      .save(resolvedOutput);
  });
}

/**
 * Convert Video format (mp4, webm, avi, mov) or Video to GIF
 */
function convertVideoFormat(inputFilePath, targetFormat = 'mp4') {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    const outputFilePath = path.join(TEMP_DIR, `video_${Date.now()}.${targetFormat}`);
    const resolvedInput = path.resolve(inputFilePath);
    const resolvedOutput = path.resolve(outputFilePath);

    let command = ffmpeg(resolvedInput);

    if (targetFormat === 'gif') {
      command = command.fps(10).size('320x?').toFormat('gif');
    } else {
      command = command.toFormat(targetFormat);
    }

    command
      .on('end', () => resolve(resolvedOutput))
      .on('error', (err) => {
        console.error(`FFmpeg Video Error (${targetFormat}):`, err.message || err);
        reject(err);
      })
      .save(resolvedOutput);
  });
}

// -------------------------------------------------------------------
// 2. IMAGE CONVERTERS (Sharp & PDF-lib)
// -------------------------------------------------------------------

/**
 * Convert Image to target format (png, jpg, webp, pdf)
 */
async function convertImageFormat(imagePath, targetFormat = 'png') {
  const outputFilePath = path.join(TEMP_DIR, `img_${Date.now()}.${targetFormat}`);

  if (targetFormat.toLowerCase() === 'pdf') {
    return await convertImageToPdf(imagePath);
  }

  let pipeline = sharp(imagePath);

  if (targetFormat === 'jpg' || targetFormat === 'jpeg') {
    pipeline = pipeline.jpeg({ quality: 90 });
  } else if (targetFormat === 'png') {
    pipeline = pipeline.png();
  } else if (targetFormat === 'webp') {
    pipeline = pipeline.webp({ quality: 90 });
  }

  await pipeline.toFile(outputFilePath);
  return outputFilePath;
}

/**
 * Convert Image to PDF
 */
/**
 * Convert Image to PDF with NaN dimension protection
 */
async function convertImageToPdf(imagePath) {
  const outputFilePath = path.join(TEMP_DIR, `doc_${Date.now()}.pdf`);
  const pdfDoc = await PDFDocument.create();

  // Inspect metadata safely to ensure valid numeric dimensions
  const metadata = await sharp(imagePath).rotate().metadata();
  const validWidth = metadata.width && !isNaN(metadata.width) && metadata.width > 0 ? metadata.width : 595;
  const validHeight = metadata.height && !isNaN(metadata.height) && metadata.height > 0 ? metadata.height : 842;

  const jpegBuffer = await sharp(imagePath)
    .rotate()
    .resize({ width: validWidth, height: validHeight, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();

  const image = await pdfDoc.embedJpg(jpegBuffer);
  const imgWidth = image.width && !isNaN(image.width) && image.width > 0 ? image.width : validWidth;
  const imgHeight = image.height && !isNaN(image.height) && image.height > 0 ? image.height : validHeight;

  const page = pdfDoc.addPage([imgWidth, imgHeight]);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: imgWidth,
    height: imgHeight,
  });

  const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
  fs.writeFileSync(outputFilePath, pdfBytes);
  return outputFilePath;
}

/**
 * Remove Image Background (Official remove.bg API or 100% Free Local AI engine)
 */
async function removeImageBackground(imagePath, removeBgApiKey = '') {
  const apiKey = removeBgApiKey || (config && config.removeBgApiKey) || process.env.REMOVE_BG_API_KEY || '';
  const outputFilePath = path.join(TEMP_DIR, `nobg_${Date.now()}.png`);

  // TIER 1: Official remove.bg API (If API key provided in .env or config)
  if (apiKey && apiKey.trim()) {
    try {
      const formData = new FormData();
      formData.append('size', 'auto');
      formData.append('type', 'auto');
      formData.append('image_file', fs.createReadStream(imagePath));

      const response = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
        headers: {
          ...formData.getHeaders(),
          'X-Api-Key': apiKey.trim(),
        },
        responseType: 'arraybuffer',
        timeout: 25000
      });

      if (response.data && response.data.length > 500) {
        fs.writeFileSync(outputFilePath, response.data);
        return outputFilePath;
      }
    } catch (err) {
      console.error('remove.bg API Error:', err.response?.data ? err.response.data.toString() : err.message);
    }
  }

  // TIER 2: 100% Free AI Engine (Hugging Face BRIA AI RMBG-1.4 Model - Free Open Source AI)
  try {
    const imgBuffer = fs.readFileSync(imagePath);
    const hfToken = process.env.HF_TOKEN || '';
    const headers = { "Content-Type": "application/octet-stream" };
    if (hfToken) headers["Authorization"] = `Bearer ${hfToken}`;

    const hfResponse = await axios.post(
      "https://api-inference.huggingface.co/models/briaai/RMBG-1.4",
      imgBuffer,
      {
        headers,
        responseType: 'arraybuffer',
        timeout: 20000
      }
    );

    if (hfResponse.data && hfResponse.data.length > 1000) {
      fs.writeFileSync(outputFilePath, hfResponse.data);
      return outputFilePath;
    }
  } catch (hfErr) {
    console.error("HuggingFace BRIA AI RMBG-1.4 note:", hfErr.message);
  }

  // TIER 3: Local @imgly AI Engine with CDN Asset Path
  try {
    const { removeBackground } = require('@imgly/background-removal-node');
    const blob = await removeBackground(imagePath, {
      model: 'small',
      publicPath: 'https://static.imgly.com/assets/background-removal-data/1.4.5/'
    });
    const buffer = Buffer.from(await blob.arrayBuffer());
    if (buffer && buffer.length > 500) {
      fs.writeFileSync(outputFilePath, buffer);
      if (global.gc) global.gc();
      return outputFilePath;
    }
  } catch (err) {
    console.error('Local @imgly removal note:', err.message);
  }

  // TIER 3: High-Precision Local Sharp Adaptive Color Distance & Edge-Smoothing Engine
  const { data, info } = await sharp(imagePath)
    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelCount = info.width * info.height;
  const outBuffer = Buffer.from(data);

  // Sample outer perimeter (top, bottom, left, right edges) to calculate background color profile
  let sumR = 0, sumG = 0, sumB = 0, sampleCount = 0;
  const step = Math.max(1, Math.floor(info.width / 40));

  for (let x = 0; x < info.width; x += step) {
    const topIdx = x * 4;
    const botIdx = ((info.height - 1) * info.width + x) * 4;
    sumR += data[topIdx] + data[botIdx];
    sumG += data[topIdx + 1] + data[botIdx + 1];
    sumB += data[topIdx + 2] + data[botIdx + 2];
    sampleCount += 2;
  }
  for (let y = 0; y < info.height; y += step) {
    const leftIdx = (y * info.width) * 4;
    const rightIdx = (y * info.width + info.width - 1) * 4;
    sumR += data[leftIdx] + data[rightIdx];
    sumG += data[leftIdx + 1] + data[rightIdx + 1];
    sumB += data[leftIdx + 2] + data[rightIdx + 2];
    sampleCount += 2;
  }

  const bgR = sumR / sampleCount;
  const bgG = sumG / sampleCount;
  const bgB = sumB / sampleCount;

  const maxTolerance = 65;

  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    const r = outBuffer[idx];
    const g = outBuffer[idx + 1];
    const b = outBuffer[idx + 2];

    const distance = Math.sqrt(
      Math.pow(r - bgR, 2) +
      Math.pow(g - bgG, 2) +
      Math.pow(b - bgB, 2)
    );

    if (distance < maxTolerance) {
      if (distance < maxTolerance * 0.6) {
        outBuffer[idx + 3] = 0; // Transparent
      } else {
        const alphaFraction = (distance - maxTolerance * 0.6) / (maxTolerance * 0.4);
        outBuffer[idx + 3] = Math.round(alphaFraction * 255);
      }
    }
  }

  await sharp(outBuffer, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(outputFilePath);

  if (global.gc) global.gc();
  return outputFilePath;
}

// -------------------------------------------------------------------
// 3. DOCUMENT CONVERTERS (PDF, DOCX, TXT)
// -------------------------------------------------------------------

/**
 * Extract Text from Image (PNG/JPG/WEBP) using Tesseract.js OCR
 */
async function extractTextFromImage(imagePath) {
  try {
    const { createWorker } = require('tesseract.js');
    const worker = await createWorker('eng');
    const ret = await worker.recognize(imagePath);
    await worker.terminate();
    return ret.data.text || "No text detected in image.";
  } catch (err) {
    console.error("Tesseract OCR Error:", err.message);
    return "Failed to perform OCR on image.";
  }
}

/**
 * Extract Text from PDF file using Auto-Decryption + Mozilla PDF.js + pdf-parse + pdf2json + Raw Stream TJ Extractor
 */
async function convertPdfToText(pdfPath) {
  let targetPdfPath = pdfPath;
  let tempCleanPath = null;

  // Step 0: Auto-unprotect / decrypt PDF using pdf-lib ignoreEncryption
  try {
    const rawBuffer = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(rawBuffer, { ignoreEncryption: true });
    const cleanBytes = await pdfDoc.save({ useObjectStreams: false });
    tempCleanPath = path.join(TEMP_DIR, `clean_${Date.now()}.pdf`);
    fs.writeFileSync(tempCleanPath, cleanBytes);
    targetPdfPath = tempCleanPath;
  } catch (e) {
    console.error("PDF auto-unprotect attempt note:", e.message);
  }

  try {
    // Method A: Primary Mozilla PDF.js Engine (Handles all complex, un-XRef'd & custom font PDFs)
    try {
      const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
      const dataBuffer = fs.readFileSync(targetPdfPath);
      const data = new Uint8Array(dataBuffer);
      const loadingTask = pdfjsLib.getDocument({
        data,
        disableFontFace: true,
        useSystemFonts: true
      });
      const pdfDocument = await loadingTask.promise;

      let fullText = '';
      for (let i = 1; i <= pdfDocument.numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent({
          normalizeWhitespace: true,
          disableCombineTextItems: false
        });

        const pageText = (textContent.items || [])
          .map(item => (typeof item.str === 'string' ? item.str : ''))
          .filter(Boolean)
          .join(' ');

        if (pageText.trim()) {
          fullText += `--- Page ${i} ---\n${pageText.trim()}\n\n`;
        }
      }
      if (fullText.trim()) return fullText.trim();
    } catch (err) {
      console.error("Mozilla PDF.js error, attempting pdf-parse fallback:", err.message);
    }

    // Method B: Fallback pdf-parse
    try {
      const pdfParse = require('pdf-parse');
      const dataBuffer = fs.readFileSync(targetPdfPath);
      const parsed = await pdfParse(dataBuffer);
      if (parsed && parsed.text && parsed.text.trim()) {
        return parsed.text.trim();
      }
    } catch (err) {
      console.error("pdf-parse fallback error:", err.message);
    }

    // Method C: Fallback pdf2json
    try {
      const text = await new Promise((resolve, reject) => {
        const PDFParser = require('pdf2json');
        const pdfParser = new PDFParser(null, 1);

        pdfParser.on('pdfParser_dataError', (errData) => {
          reject(new Error(errData.parserError || 'Failed to parse PDF text'));
        });

        pdfParser.on('pdfParser_dataReady', () => {
          const rawText = pdfParser.getRawTextContent();
          resolve(rawText || '');
        });

        pdfParser.loadPDF(targetPdfPath);
      });

      if (text && text.trim()) return text.trim();
    } catch (err) {
      console.error("pdf2json error:", err.message);
    }

    // Method D: Raw Stream TJ/Tj Operator Extractor (Reads text directly from raw binary PDF stream)
    try {
      const rawBuffer = fs.readFileSync(pdfPath).toString('binary');
      const matches = rawBuffer.match(/\(([^()]+)\)\s*TJ|\(([^()]+)\)\s*Tj/g);
      if (matches && matches.length > 0) {
        const extractedStrings = matches
          .map(m => m.replace(/[()]/g, '').replace(/\s*(TJ|Tj)/, ''))
          .filter(str => str.length > 2 && /[a-zA-Z0-9]/.test(str))
          .join(' ');
        if (extractedStrings.trim().length > 10) {
          return extractedStrings.trim();
        }
      }
    } catch (rawErr) {
      console.error("Raw stream extraction error:", rawErr.message);
    }

    throw new Error("Unable to extract text from this PDF. It appears to be an image-only scanned document without digital text fonts. Try converting images directly!");
  } finally {
    if (tempCleanPath) cleanupFile(tempCleanPath);
  }
}

/**
 * Convert DOCX or Plain Text file to TXT
 */
async function convertDocxToText(docxPath) {
  try {
    const result = await mammoth.extractRawText({ path: docxPath });
    if (result && result.value && result.value.trim()) {
      return result.value;
    }
  } catch (err) {
    console.error("mammoth docx extract note, falling back to plain text read:", err.message);
  }

  try {
    const textContent = fs.readFileSync(docxPath, 'utf8');
    if (textContent && textContent.trim()) return textContent;
  } catch (e) {
    console.error("fs.readFileSync error:", e.message);
  }

  return "No readable text found in document.";
}

/**
 * Convert Plain Text or DOCX to PDF (Auto line wrapping & multi-page support)
 */
async function convertTextToPdf(textContent) {
  const outputFilePath = path.join(TEMP_DIR, `doc_${Date.now()}.pdf`);
  const pdfDoc = await PDFDocument.create();

  const safeContent = typeof textContent === 'string' && textContent.trim() ? textContent : "No text content provided.";
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let page = pdfDoc.addPage([595.28, 841.89]); // Standard A4 Size
  const { height } = page.getSize();
  const fontSize = 10;
  const lineHeight = 14;
  const margin = 45;
  const maxCharsPerLine = 85;

  const rawLines = safeContent.split(/\r?\n/);
  let y = height - margin;

  for (const rawLine of rawLines) {
    // Sanitize non-ASCII unicode characters to standard ASCII representation for Helvetica
    const sanitizedLine = (rawLine || '')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[^\x00-\x7F]/g, " ");

    // Auto line wrapping for long paragraphs
    let currentPos = 0;
    while (currentPos < sanitizedLine.length || (currentPos === 0 && sanitizedLine.length === 0)) {
      if (y < margin + lineHeight) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = height - margin;
      }

      const chunk = sanitizedLine.substring(currentPos, currentPos + maxCharsPerLine);
      if (chunk.trim()) {
        page.drawText(chunk, {
          x: margin,
          y: y,
          size: fontSize,
          font: font,
          color: rgb(0.1, 0.1, 0.1),
        });
      }

      y -= lineHeight;
      currentPos += maxCharsPerLine;
      if (sanitizedLine.length === 0) break;
    }
  }

  const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
  fs.writeFileSync(outputFilePath, pdfBytes);
  return outputFilePath;
}

/**
 * Extract direct MP4 video link from Instagram Reel or Post
 */
async function getInstagramVideoUrl(instagramUrl) {
  try {
    const cleanUrl = instagramUrl.split('?')[0].replace(/\/$/, '') + '/embed/captioned/';
    const response = await axios.get(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const html = response.data;
    const videoMatch = html.match(/<video[^>]+src="([^"]+)"/i) ||
                       html.match(/<meta\s+property="og:video"\s+content="([^"]+)"/i) ||
                       html.match(/"video_url":"([^"]+)"/i);

    if (videoMatch && videoMatch[1]) {
      return videoMatch[1].replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
    }
  } catch (err) {
    console.error("Instagram embed extract error:", err.message);
  }
  return null;
}

/**
 * Download Video from URL (YouTube, Instagram, TikTok, Web video) to MP3 using yt-dlp
 */
async function downloadUrlToMp3(videoUrl) {
  const outputFilePath = path.join(TEMP_DIR, `url_${Date.now()}.mp3`);
  const ytdlpHelper = require('./ytdlpHelper');

  try {
    await ytdlpHelper.downloadAudioWithYtDlp(videoUrl, outputFilePath);

    if (fs.existsSync(outputFilePath) && fs.statSync(outputFilePath).size > 1000) {
      return outputFilePath;
    } else {
      throw new Error("Unable to extract audio from URL. Please send video file directly!");
    }
  } catch (ytErr) {
    console.error("yt-dlp extraction note:", ytErr.message);
    cleanupFile(outputFilePath);
    throw new Error("Unable to extract MP3 from URL. YouTube or website protected this video. Please upload your video file directly to convert to MP3!");
  }
}

/**
 * Replace transparent background of image with solid white color (Supports PNG, WEBP, JPEG & Photo Subjects)
 */
async function fillTransparentBackground(imagePath, fillColor = '#ffffff') {
  const outputFilePath = path.join(TEMP_DIR, `whitebg_${Date.now()}.jpg`);

  try {
    const metadata = await sharp(imagePath).metadata();

    // If image has alpha (transparent PNG/WEBP), flatten directly onto solid white #ffffff
    if (metadata.hasAlpha) {
      await sharp(imagePath)
        .flatten({ background: fillColor })
        .jpeg({ quality: 98 })
        .toFile(outputFilePath);
      return outputFilePath;
    }

    // Smart Threshold for JPEG photos/signatures/paper scans/graphics:
    // Convert near-white/grey/checkerboard background pixels to pure solid white #ffffff
    const { data, info } = await sharp(imagePath).raw().toBuffer({ resolveWithObject: true });
    const pixelCount = info.width * info.height;
    const channels = info.channels;
    const outBuffer = Buffer.alloc(pixelCount * 4);

    for (let i = 0; i < pixelCount; i++) {
      const srcIdx = i * channels;
      const dstIdx = i * 4;

      const r = data[srcIdx];
      const g = data[srcIdx + 1];
      const b = data[srcIdx + 2];
      const a = channels === 4 ? data[srcIdx + 3] : 255;

      // Force transparent pixels or light/grey background pixels to pure white #ffffff
      if (a < 128 || (r > 200 && g > 200 && b > 200)) {
        outBuffer[dstIdx] = 255;
        outBuffer[dstIdx + 1] = 255;
        outBuffer[dstIdx + 2] = 255;
        outBuffer[dstIdx + 3] = 255;
      } else {
        outBuffer[dstIdx] = r;
        outBuffer[dstIdx + 1] = g;
        outBuffer[dstIdx + 2] = b;
        outBuffer[dstIdx + 3] = 255;
      }
    }

    await sharp(outBuffer, { raw: { width: info.width, height: info.height, channels: 4 } })
      .jpeg({ quality: 98 })
      .toFile(outputFilePath);

    return outputFilePath;
  } catch (err) {
    console.error("fillTransparentBackground error, falling back:", err.message);
    await sharp(imagePath)
      .flatten({ background: fillColor })
      .jpeg({ quality: 95 })
      .toFile(outputFilePath);
    return outputFilePath;
  }
}

/**
 * Resize Image by Pixels or Percentage (Horizontal / Vertical)
 */
async function resizeImage(imagePath, targetWidth = null, targetHeight = null, percentage = null) {
  const outputFilePath = path.join(TEMP_DIR, `resized_${Date.now()}.png`);
  const metadata = await sharp(imagePath).metadata();
  
  let w = metadata.width || 800;
  let h = metadata.height || 600;

  if (percentage && percentage > 0) {
    const factor = percentage / 100;
    w = Math.round(w * factor);
    h = Math.round(h * factor);
  } else {
    if (targetWidth && targetWidth > 0) w = Math.round(targetWidth);
    if (targetHeight && targetHeight > 0) h = Math.round(targetHeight);
  }

  await sharp(imagePath)
    .resize({ width: w, height: h, fit: 'fill' })
    .png()
    .toFile(outputFilePath);

  return outputFilePath;
}

/**
 * Compress / Minimize Photo File Size to Target KB or MB
 */
async function compressImageToTargetSize(imagePath, targetSizeKb = 200) {
  const outputFilePath = path.join(TEMP_DIR, `compressed_${Date.now()}.jpg`);
  
  let quality = 90;
  let widthScale = 1.0;
  const metadata = await sharp(imagePath).metadata();
  const origW = metadata.width || 1200;

  for (let attempt = 0; attempt < 8; attempt++) {
    const curW = Math.max(100, Math.round(origW * widthScale));
    await sharp(imagePath)
      .resize({ width: curW, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: Math.max(15, quality), mozjpeg: true })
      .toFile(outputFilePath);

    const stats = fs.statSync(outputFilePath);
    const currentKb = stats.size / 1024;

    if (currentKb <= targetSizeKb || (quality <= 20 && widthScale <= 0.3)) {
      break;
    }

    quality -= 15;
    if (quality < 35) {
      widthScale *= 0.85;
    }
  }

  return outputFilePath;
}

/**
 * Cleanup temporary files
 */
function cleanupFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    console.error("Cleanup error:", e.message);
  }
}

module.exports = {
  convertMediaToAudio,
  convertVideoFormat,
  convertImageFormat,
  convertImageToPdf,
  removeImageBackground,
  fillTransparentBackground,
  resizeImage,
  compressImageToTargetSize,
  extractTextFromImage,
  convertPdfToText,
  convertDocxToText,
  convertTextToPdf,
  downloadUrlToMp3,
  cleanupFile,
  TEMP_DIR
};
