const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const pdfParse = require('pdf-parse');
const sharp = require('sharp');
const axios = require('axios');
const FormData = require('form-data');
const config = require('../config');

ffmpeg.setFfmpegPath(ffmpegPath);

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
    return outputFilePath;
  } catch (err) {
    console.error('Local BG Removal Error:', err.message);
    // Fallback PNG conversion
    await sharp(imagePath).png().toFile(outputFilePath);
    return outputFilePath;
  }
}

// -------------------------------------------------------------------
// 3. DOCUMENT CONVERTERS (PDF, DOCX, TXT)
// -------------------------------------------------------------------

/**
 * Extract Text from PDF file using pdf2json + fallback pdf-parse
 */
async function convertPdfToText(pdfPath) {
  // Method A: Try pdf2json
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

      pdfParser.loadPDF(pdfPath);
    });

    if (text && text.trim()) return text;
  } catch (err) {
    console.error("pdf2json error, attempting pdf-parse fallback:", err.message);
  }

  // Method B: Fallback to pdf-parse for corrupted XRef tables & custom PDF headers
  try {
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(pdfPath);
    const parsed = await pdfParse(dataBuffer);
    if (parsed.text && parsed.text.trim()) {
      return parsed.text;
    }
  } catch (err) {
    console.error("pdf-parse fallback error:", err.message);
  }

  throw new Error("Password-protected or corrupted PDF. Please upload an unprotected PDF file!");
}

/**
 * Convert DOCX file to TXT
 */
async function convertDocxToText(docxPath) {
  const result = await mammoth.extractRawText({ path: docxPath });
  return result.value || "No readable text found in Word document.";
}

/**
 * Convert Plain Text or DOCX to PDF
 */
async function convertTextToPdf(textContent) {
  const outputFilePath = path.join(TEMP_DIR, `doc_${Date.now()}.pdf`);
  const pdfDoc = await PDFDocument.create();

  const safeContent = typeof textContent === 'string' && textContent.trim() ? textContent : "No text content found.";
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let page = pdfDoc.addPage([595.28, 841.89]); // A4 Size
  const { height } = page.getSize();
  const fontSize = 11;
  const margin = 40;

  const lines = safeContent.split('\n');
  let y = height - margin;

  for (const line of lines) {
    if (y < margin + 20 || isNaN(y)) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = height - margin;
    }

    const safeText = (line || '').substring(0, 90).replace(/[^\x00-\x7F]/g, "?");
    if (safeText.trim()) {
      page.drawText(safeText, {
        x: margin,
        y: isNaN(y) ? margin : y,
        size: fontSize,
        font: timesRomanFont,
        color: rgb(0, 0, 0),
      });
    }
    y -= fontSize + 4;
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
              reject(new Error("YouTube stream protected. Please send video file directly!"));
            })
            .save(normalizedOutput);
        });
      }
    } catch (err) {
      throw new Error("YouTube stream protected. Please send video file directly!");
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
 * Replace transparent background of image with solid white color
 */
async function fillTransparentBackground(imagePath, fillColor = '#ffffff') {
  const outputFilePath = path.join(TEMP_DIR, `whitebg_${Date.now()}.png`);
  await sharp(imagePath)
    .flatten({ background: fillColor })
    .png()
    .toFile(outputFilePath);
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
  convertPdfToText,
  convertDocxToText,
  convertTextToPdf,
  downloadUrlToMp3,
  cleanupFile,
  TEMP_DIR
};
