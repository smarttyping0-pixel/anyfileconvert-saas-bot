const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execFile } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const BIN_DIR = path.join(__dirname, '../../bin');
const isWin = process.platform === 'win32';
const YTDLP_PATH = path.join(BIN_DIR, isWin ? 'yt-dlp.exe' : 'yt-dlp');

async function ensureYtDlpBinary() {
  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
  }

  if (fs.existsSync(YTDLP_PATH) && fs.statSync(YTDLP_PATH).size > 1000000) {
    return YTDLP_PATH;
  }

  console.log("📥 Downloading latest yt-dlp binary from GitHub Releases...");
  const downloadUrl = isWin
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
    : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

  const writer = fs.createWriteStream(YTDLP_PATH);
  const response = await axios({
    url: downloadUrl,
    method: 'GET',
    responseType: 'stream',
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });

  await new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  if (!isWin) {
    try {
      fs.chmodSync(YTDLP_PATH, '755');
    } catch (e) {}
  }

  console.log("✅ yt-dlp binary initialized:", YTDLP_PATH);
  return YTDLP_PATH;
}

async function downloadAudioWithYtDlp(url, outputFilePath) {
  const binaryPath = await ensureYtDlpBinary();

  return new Promise((resolve, reject) => {
    const ffmpegDir = path.dirname(ffmpegPath);
    const args = [
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--ffmpeg-location', ffmpegDir,
      '--no-playlist',
      '-o', outputFilePath,
      url
    ];

    execFile(binaryPath, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error("yt-dlp execution error:", stderr || error.message);
        reject(error);
      } else {
        resolve(outputFilePath);
      }
    });
  });
}

module.exports = {
  ensureYtDlpBinary,
  downloadAudioWithYtDlp
};
