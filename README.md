# 🎬 Telegram Universal File & Media Converter Micro-SaaS Bot

Welcome to your **Universal File & Media Converter Bot**! A complete production-ready Telegram Micro-SaaS for processing, converting, and manipulating files directly inside Telegram.

---

## 🛠️ Features Included

1. 🎥 **Video to MP3 Converter:** Automatically extracts high-quality audio (`.mp3`) from any uploaded video file, video note, or clip using **FFmpeg**.
2. 🖼️ **Image to PDF Converter:** Converts photos, screenshots, PNG/JPEG files into a clean PDF document.
3. 📄 **PDF to Text Extractor:** Parses PDF files and extracts all readable text into a `.txt` document.
4. ✂️ **Background Remover:** Cleans and removes background from photos sent with caption `remove bg`.
5. 💳 **Monetization & Credit System:** Includes Telegram Stars payment integration, daily free credit limit (10 credits/day), user profile, and plan upgrade.

---

## 📁 Project Structure

```
telegram-ai-saas-bot/
├── .env                      # Bot credentials & configuration
├── package.json              # Dependencies (grammy, fluent-ffmpeg, pdf-lib, sharp)
├── db.json                   # User ledger & credit tracking
├── README.md                 # Documentation
└── src/
    ├── config.js             # Configuration validator
    ├── bot.js                # Main bot listeners & file routing
    ├── handlers/
    │   ├── start.js          # Main menu & user profile
    │   ├── fileConverter.js  # Video-to-MP3, Image-to-PDF, PDF-to-TXT handlers
    │   └── payment.js        # Telegram Stars payment engine
    └── services/
        ├── mediaService.js   # FFmpeg video processing, Sharp image engine, PDF-lib
        └── database.js       # User credits & billing database
```

---

## 🚀 How to Run

1. Open PowerShell or Terminal in the project directory:
   ```bash
   cd C:\Users\Rr040\telegram-ai-saas-bot
   npm install
   ```
2. Start the bot:
   ```bash
   npm run dev
   ```
3. Open Telegram, search for your bot (**`@DocuSummarizeAiBot`**), and send a video, photo, or PDF!
