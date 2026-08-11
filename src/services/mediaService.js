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
    const outputFilePath = path.join(TEMP_DIR, `audio_${Date.now()}.${targetFormat}`);
    const normalizedInput = path.resolve(inputFilePath).replace(/\\/g, '/');
    const normalizedOutput = path.resolve(outputFilePath).replace(/\\/g, '/');

    ffmpeg(normalizedInput)
      .noVideo()
      .toFormat(targetFormat)
      .on('end', () => resolve(normalizedOutput))
      .on('error', (err) => {
        console.error(`FFmpeg Audio Error (${targetFormat}):`, err.message);
        reject(err);
      })
      .save(normalizedOutput);
  });
}

/**
 * Convert Video format (mp4, webm, avi, mov) or Video to GIF
 */
function convertVideoFormat(inputFilePath, targetFormat = 'mp4') {
  return new Promise((resolve, reject) => {
    const outputFilePath = path.join(TEMP_DIR, `video_${Date.now()}.${targetFormat}`);
    const normalizedInput = path.resolve(inputFilePath).replace(/\\/g, '/');
    const normalizedOutput = path.resolve(outputFilePath).replace(/\\/g, '/');

    let command = ffmpeg(normalizedInput).toFormat(targetFormat);

    if (targetFormat === 'gif') {
      command = command.fps(10).size('320x?');
    }

    command
      .on('end', () => resolve(normalizedOutput))
      .on('error', (err) => {
        console.error(`FFmpeg Video Error (${targetFormat}):`, err);
        reject(err);
      })
      .save(normalizedOutput);
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

  // Option A: Use official remove.bg API key if configured
  if (apiKey) {
    try {
      const formData = new FormData();
      formData.append('size', 'auto');
      formData.append('image_file', fs.createReadStream(imagePath));

      const response = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
        headers: {
          ...formData.getHeaders(),
          'X-Api-Key': apiKey,
        },
        responseType: 'arraybuffer',
      });

      fs.writeFileSync(outputFilePath, response.data);
      return outputFilePath;
    } catch (err) {
      console.error('remove.bg API Error, switching to local AI:', err.message);
    }
  }

  // Option B: 100% Free Local AI Background Removal
  try {
    const { removeBackground } = require('@imgly/background-removal-node');
    const blob = await removeBackground(imagePath);
    const buffer = Buffer.from(await blob.arrayBuffer());
    fs.writeFileSync(outputFilePath, buffer);
    if (global.gc) global.gc(); // Instantly free V8 heap memory after AI processing
    return outputFilePath;
  } catch (err) {
    console.error('Local BG Removal Error:', err.message);
    // Fallback PNG conversion
    await sharp(imagePath).png().toFile(outputFilePath);
    if (global.gc) global.gc();
    return outputFilePath;
  }
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
 * Download Video from URL (YouTube, Instagram Reels/Posts, Web video, Direct link) and convert to MP3
 */
async function downloadUrlToMp3(videoUrl) {
  const outputFilePath = path.join(TEMP_DIR, `url_${Date.now()}.mp3`);
  const normalizedOutput = path.resolve(outputFilePath).replace(/\\/g, '/');

  // Case 1: Instagram Reel or Post URL
  if (videoUrl.includes('instagram.com')) {
    const directVideoUrl = await getInstagramVideoUrl(videoUrl);
    if (directVideoUrl) {
      const tempPath = path.join(TEMP_DIR, `ig_${Date.now()}.mp4`);
      try {
        const response = await axios({
          method: 'GET',
          url: directVideoUrl,
          responseType: 'stream',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        const contentType = (response.headers['content-type'] || '').toLowerCase();
        if (contentType.includes('text/html') || contentType.includes('application/json')) {
          throw new Error("Private or protected Instagram Reel. Please send video file directly!");
        }

        const writer = fs.createWriteStream(tempPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });

        const stats = fs.statSync(tempPath);
        if (stats.size < 10000) { // Less than 10KB is an HTML error page
          cleanupFile(tempPath);
          throw new Error("Protected Instagram post. Please send video file directly!");
        }

        const audioPath = await convertMediaToAudio(tempPath, 'mp3');
        cleanupFile(tempPath);
        return audioPath;
      } catch (err) {
        cleanupFile(tempPath);
        throw new Error(err.message || "Unable to download Instagram video from link.");
      }
    }
  }

  const ytdl = require('@distube/ytdl-core');

  // Case 2: YouTube URL
  if (ytdl.validateURL(videoUrl)) {
    try {
      let agent = undefined;
      const cookiePath = path.join(__dirname, '../../youtube_cookies.txt');
      if (fs.existsSync(cookiePath)) {
        try {
          const rawCookies = fs.readFileSync(cookiePath, 'utf8');
          const cookiesJson = rawCookies
            .split('\n')
            .filter(line => line.trim() && !line.startsWith('#'))
            .map(line => {
              const parts = line.split('\t');
              if (parts.length >= 7) {
                return { name: parts[5].trim(), value: parts[6].trim() };
              }
              return null;
            })
            .filter(Boolean);

          if (cookiesJson.length > 0) {
            agent = ytdl.createAgent(cookiesJson);
          }
        } catch (e) {
          console.error("Error creating ytdl agent from cookies:", e.message);
        }
      }

      const infoOptions = agent ? { agent } : {
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        }
      };

      const info = await ytdl.getInfo(videoUrl, infoOptions);
      const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
      const selectedFormat = audioFormats[0] || info.formats[0];

      if (selectedFormat && selectedFormat.url) {
        return new Promise((resolve, reject) => {
          ffmpeg(selectedFormat.url)
            .inputOptions([
              '-headers', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n'
            ])
            .noVideo()
            .toFormat('mp3')
            .audioBitrate('192k')
            .on('end', () => resolve(normalizedOutput))
            .on('error', (err) => {
              reject(new Error("YouTube blocks automated cloud servers. Please send Instagram Reels, MP4 video links, or upload your video file directly to convert to MP3!"));
            })
            .save(normalizedOutput);
        });
      }
    } catch (err) {
      throw new Error("YouTube anti-bot block: YouTube blocks cloud server IPs. Please send Instagram Reels, MP4 links, or upload your video file directly!");
    }
  }

  // Case 3: Direct Video Link / Web video URL
  return new Promise(async (resolve, reject) => {
    const tempVideoPath = path.join(TEMP_DIR, `web_${Date.now()}.tmp`);
    try {
      const response = await axios({
        method: 'GET',
        url: videoUrl,
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
      });

      const contentType = (response.headers['content-type'] || '').toLowerCase();
      if (contentType.includes('text/html') || contentType.includes('application/json')) {
        return reject(new Error("URL returned an HTML web page instead of a video file. Please send direct video file!"));
      }

      const normalizedTemp = path.resolve(tempVideoPath).replace(/\\/g, '/');
      const writer = fs.createWriteStream(normalizedTemp);

      response.data.pipe(writer);

      writer.on('finish', () => {
        const stats = fs.statSync(normalizedTemp);
        if (stats.size < 10000) {
          cleanupFile(normalizedTemp);
          return reject(new Error("File too small or invalid video stream. Please upload video file directly!"));
        }

        convertMediaToAudio(normalizedTemp, 'mp3')
          .then((res) => {
            cleanupFile(normalizedTemp);
            resolve(res);
          })
          .catch((err) => {
            cleanupFile(normalizedTemp);
            reject(new Error("Invalid video stream at URL. Please upload video file directly!"));
          });
      });

      writer.on('error', (err) => {
        cleanupFile(normalizedTemp);
        reject(err);
      });
    } catch (err) {
      cleanupFile(tempVideoPath);
      reject(new Error(`Inaccessible video link: ${err.message}`));
    }
  });
}

/**
 * Replace transparent background of image with solid white color (Supports PNG, WEBP, JPEG & Photo Subjects)
 */
async function fillTransparentBackground(imagePath, fillColor = '#ffffff') {
  const outputFilePath = path.join(TEMP_DIR, `whitebg_${Date.now()}.png`);
  let targetPath = imagePath;
  let tempRemovedPath = null;

  try {
    const metadata = await sharp(imagePath).metadata();
    const hasAlpha = metadata.hasAlpha;

    // If image is a standard photo (JPEG/no alpha), isolate subject first via AI background removal
    if (!hasAlpha || metadata.format === 'jpeg' || metadata.format === 'jpg') {
      try {
        tempRemovedPath = await removeImageBackground(imagePath, process.env.REMOVE_BG_API_KEY || '');
        if (tempRemovedPath && fs.existsSync(tempRemovedPath)) {
          targetPath = tempRemovedPath;
        }
      } catch (e) {
        console.error("BG Removal pre-pass note:", e.message);
      }
    }

    const targetMeta = await sharp(targetPath).metadata();
    const w = targetMeta.width || 800;
    const h = targetMeta.height || 600;

    const bgCanvas = await sharp({
      create: {
        width: w,
        height: h,
        channels: 4,
        background: fillColor
      }
    }).png().toBuffer();

    await sharp(bgCanvas)
      .composite([{ input: targetPath, blend: 'over' }])
      .png()
      .toFile(outputFilePath);

    return outputFilePath;
  } catch (err) {
    console.error("fillTransparentBackground error, falling back:", err.message);
    await sharp(imagePath)
      .flatten({ background: fillColor })
      .png()
      .toFile(outputFilePath);
    return outputFilePath;
  } finally {
    if (tempRemovedPath) cleanupFile(tempRemovedPath);
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
