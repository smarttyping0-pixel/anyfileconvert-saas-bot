const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mediaService = require('./services/mediaService');
const db = require('./services/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve Mini App Static Frontend
app.use(express.static(path.join(__dirname, '../public')));

// Configure Multer for uploaded files
const upload = multer({ dest: mediaService.TEMP_DIR });

// -------------------------------------------------------------
// REST API ENDPOINTS
// -------------------------------------------------------------

// 1. Convert File Upload
app.post('/api/convert', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }

  const { task, userId } = req.body;
  const inputFilePath = req.file.path;
  let outputPath = null;

  try {
    if (task === 'v2mp3') {
      outputPath = await mediaService.convertMediaToAudio(inputFilePath, 'mp3');
    } else if (task === 'v2gif') {
      outputPath = await mediaService.convertVideoFormat(inputFilePath, 'gif');
    } else if (task === 'img2pdf') {
      outputPath = await mediaService.convertImageToPdf(inputFilePath);
    } else if (task === 'bgrem') {
      outputPath = await mediaService.removeImageBackground(inputFilePath, process.env.REMOVE_BG_API_KEY || '');
    } else if (task === 'pdf2txt') {
      const text = await mediaService.convertPdfToText(inputFilePath);
      outputPath = path.join(mediaService.TEMP_DIR, `extracted_${Date.now()}.txt`);
      fs.writeFileSync(outputPath, text, 'utf8');
    } else if (task === 'docx2pdf') {
      const docxText = await mediaService.convertDocxToText(inputFilePath);
      outputPath = await mediaService.convertTextToPdf(docxText);
    } else if (task === 'imgconv') {
      outputPath = await mediaService.convertImageFormat(inputFilePath, 'png');
    } else {
      outputPath = await mediaService.convertImageToPdf(inputFilePath);
    }

    if (userId) {
      db.deductCredits(userId, 1); // Deduct ONLY on success
    }

    const fileName = path.basename(outputPath);

    res.json({
      success: true,
      fileName: fileName,
      downloadUrl: `/downloads/${fileName}`
    });
  } catch (err) {
    console.error('API Convert Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Conversion failed' });
  } finally {
    mediaService.cleanupFile(inputFilePath);
  }
});

// 2. Convert Video URL to MP3
app.post('/api/convert-url', async (req, res) => {
  const { url, userId } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, error: 'No URL provided' });
  }

  try {
    const outputPath = await mediaService.downloadUrlToMp3(url);

    if (userId) {
      db.deductCredits(userId, 1); // Deduct ONLY on success
    }

    const fileName = path.basename(outputPath);

    res.json({
      success: true,
      fileName: fileName,
      downloadUrl: `/downloads/${fileName}`
    });
  } catch (err) {
    console.error('API Convert URL Error:', err);
    res.status(500).json({ success: false, error: err.message || 'URL conversion failed' });
  }
});

// 3. Claim Daily Bonus
app.post('/api/daily-bonus', (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, error: 'User ID missing' });

  const result = db.claimDailyBonus(userId);
  res.json(result);
});

// 4. Download Converted Files
app.get('/downloads/:fileName', (req, res) => {
  const filePath = path.join(mediaService.TEMP_DIR, req.params.fileName);
  if (fs.existsSync(filePath)) {
    res.download(filePath, () => {
      // Cleanup after download finishes
      setTimeout(() => mediaService.cleanupFile(filePath), 5000);
    });
  } else {
    res.status(404).send('File not found or expired');
  }
});

// Start Express Server
function startServer() {
  app.listen(PORT, () => {
    console.log(`🌐 Mini App Web Server is running on http://localhost:${PORT}`);
  });
}

module.exports = {
  app,
  startServer
};
