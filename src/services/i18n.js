const db = require('./database');

const dictionary = {
  en: {
    welcomeTitle: "⚡ *All-in-One Format Converter Bot*",
    welcomeText: "Welcome! Send any file or choose a tool below:",
    btnUrlMp3: "🔗 URL to MP3",
    btnV2mp3: "🎥 Video to MP3",
    btnV2gif: "🎬 Video to GIF",
    btnImg2pdf: "📄 Image to PDF",
    btnBgrem: "✂️ Make BG Transparent",
    btnImgresize: "📐 Resize Image",
    btnImgcompress: "📉 Compress Photo",
    btnPdf2txt: "📝 PDF to Text",
    btnDocx2pdf: "📘 DOCX to PDF",
    btnImgconv: "🖼️ Convert PNG/JPG",
    btnDaily: "🎁 Daily Bonus",
    btnRef: "👥 Refer & Earn",
    btnUpgrade: "⭐ Buy Credits",
    btnProfile: "👤 My Account",
    btnLanguage: "🌐 Language",
    taskSelected: "✅ *Selected Task:* {task}\n\n📥 Please send or forward your file now!",
    processing: "⏳ *Processing file for task: {task}...*",
    successResized: "📐 *Resized Image ({label})!*",
    successCompressed: "📉 *Compressed Photo File Size ({sizeKb} KB / Target: {targetKb} KB)!*",
    successBgRemoved: "✂️ *Background Removed Image (PNG)!*",
    successFormatConv: "🖼️ *Converted Image Format!*",
    successPdf2Txt: "📝 *Extracted Text Document (OCR)!*",
    successText2Pdf: "📄 *Converted Text/DOCX to PDF!*",
    successAudioConv: "🎵 *Converted Audio File!*",
    successVideo2Mp3: "🎵 *Converted Video to MP3 Audio!*",
    successVideo2Gif: "🎬 *Converted Video to Animated GIF!*",
    errorNoCredits: "❌ *Insufficient Credits!* You need 1 credit.\n\nClaim your 🎁 Daily Bonus or upgrade to ⭐ PRO!",
  },
  es: {
    welcomeTitle: "⚡ *Bot Convertidor de Archivos Todo en Uno*",
    welcomeText: "¡Bienvenido! Envía cualquier archivo o elige una herramienta a continuación:",
    btnUrlMp3: "🔗 URL a MP3",
    btnV2mp3: "🎥 Video a MP3",
    btnV2gif: "🎬 Video a GIF",
    btnImg2pdf: "📄 Imagen a PDF",
    btnBgrem: "✂️ Fondo Transparente",
    btnImgresize: "📐 Redimensionar Imagen",
    btnImgcompress: "📉 Comprimir Foto",
    btnPdf2txt: "📝 PDF a Texto",
    btnDocx2pdf: "📘 Word a PDF",
    btnImgconv: "🖼️ Convertir PNG/JPG",
    btnDaily: "🎁 Bono Diario",
    btnRef: "👥 Referir y Ganar",
    btnUpgrade: "⭐ Comprar Créditos",
    btnProfile: "👤 Mi Cuenta",
    btnLanguage: "🌐 Idioma",
    taskSelected: "✅ *Tarea Seleccionada:* {task}\n\n📥 ¡Por favor envía tu archivo ahora!",
    processing: "⏳ *Procesando archivo para la tarea: {task}...*",
    successResized: "📐 *¡Imagen Redimensionada ({label})!*",
    successCompressed: "📉 *¡Foto Comprimida ({sizeKb} KB / Meta: {targetKb} KB)!*",
    successBgRemoved: "✂️ *¡Fondo Eliminado (PNG)!*",
    successFormatConv: "🖼️ *¡Formato de Imagen Convertido!*",
    successPdf2Txt: "📝 *¡Texto Extraído (OCR)!*",
    successText2Pdf: "📄 *¡Texto a PDF Convertido!*",
    successAudioConv: "🎵 *¡Archivo de Audio Convertido!*",
    successVideo2Mp3: "🎵 *¡Video a MP3 Convertido!*",
    successVideo2Gif: "🎬 *¡Video a GIF Animado Convertido!*",
    errorNoCredits: "❌ *¡Créditos Insuficientes!* Reclama tu 🎁 Bono Diario o compra ⭐ PRO.",
  },
  hi: {
    welcomeTitle: "⚡ *ऑल-इन-वन फ़ाइल कनवर्टर बॉट*",
    welcomeText: "स्वागत है! कोई भी फ़ाइल भेजें या नीचे एक टूल चुनें:",
    btnUrlMp3: "🔗 URL से MP3",
    btnV2mp3: "🎥 वीडियो से MP3",
    btnV2gif: "🎬 वीडियो से GIF",
    btnImg2pdf: "📄 फोटो से PDF",
    btnBgrem: "✂️ बैकग्राउंड हटाएं",
    btnImgresize: "📐 फोटो रीसाइज़ करें",
    btnImgcompress: "📉 फोटो साइज़ घटाएं",
    btnPdf2txt: "📝 PDF से टेक्स्ट",
    btnDocx2pdf: "📘 Word से PDF",
    btnImgconv: "🖼️ PNG/JPG बदलें",
    btnDaily: "🎁 दैनिक बोनस",
    btnRef: "👥 शेयर करें और कमाएं",
    btnUpgrade: "⭐ क्रेडिट खरीदें",
    btnProfile: "👤 मेरा अकाउंट",
    btnLanguage: "🌐 भाषा बदलें",
    taskSelected: "✅ *चुना गया टूल:* {task}\n\n📥 कृपया अपनी फ़ाइल भेजें!",
    processing: "⏳ *फ़ाइल प्रोसेस हो रही है: {task}...*",
    successResized: "📐 *फोटो रीसाइज़ सफल ({label})!*",
    successCompressed: "📉 *फोटो साइज़ कम हुआ ({sizeKb} KB)!*",
    successBgRemoved: "✂️ *बैकग्राउंड हट गया (PNG)!*",
    successFormatConv: "🖼️ *फ़ॉर्मेट बदल गया!*",
    successPdf2Txt: "📝 *टेक्स्ट निकल गया (OCR)!*",
    successText2Pdf: "📄 *PDF बन गया!*",
    successAudioConv: "🎵 *ऑडियो कनवर्ट हो गया!*",
    successVideo2Mp3: "🎵 *वीडियो से MP3 बन गया!*",
    successVideo2Gif: "🎬 *वीडियो से GIF बन गया!*",
    errorNoCredits: "❌ *क्रेडिट समाप्त!* अपना 🎁 दैनिक बोनस क्लेम करें या ⭐ PRO खरीदें।",
  },
  ar: {
    welcomeTitle: "⚡ *بوت تحويل الملفات الشامل*",
    welcomeText: "أهلاً بك! أرسل أي ملف أو اختر أداة من الأسفل:",
    btnUrlMp3: "🔗 رابط إلى MP3",
    btnV2mp3: "🎥 فيديو إلى MP3",
    btnV2gif: "🎬 فيديو إلى GIF",
    btnImg2pdf: "📄 صورة إلى PDF",
    btnBgrem: "✂️ إزالة الخلفية",
    btnImgresize: "📐 تغيير حجم الصورة",
    btnImgcompress: "📉 ضغط حجم الصورة",
    btnPdf2txt: "📝 PDF إلى نص",
    btnDocx2pdf: "📘 Word إلى PDF",
    btnImgconv: "🖼️ تحويل PNG/JPG",
    btnDaily: "🎁 مكافأة يومية",
    btnRef: "👥 دعوة الأصدقاء",
    btnUpgrade: "⭐ شراء رصيد",
    btnProfile: "👤 حسابي",
    btnLanguage: "🌐 اللغة",
    taskSelected: "✅ *المهمة المحددة:* {task}\n\n📥 يرجى إرسال ملفك الآن!",
    processing: "⏳ *جاري معالجة الملف: {task}...*",
    successResized: "📐 *تم تغيير حجم الصورة ({label})!*",
    successCompressed: "📉 *تم ضغط الصورة ({sizeKb} KB)!*",
    successBgRemoved: "✂️ *تمت إزالة الخلفية (PNG)!*",
    successFormatConv: "🖼️ *تم تحويل صيغة الصورة!*",
    successPdf2Txt: "📝 *تم استخراج النص (OCR)!*",
    successText2Pdf: "📄 *تم التحويل إلى PDF!*",
    successAudioConv: "🎵 *تم تحويل الملف الصوتي!*",
    successVideo2Mp3: "🎵 *تم تحويل الفيديو إلى MP3!*",
    successVideo2Gif: "🎬 *تم تحويل الفيديو إلى GIF!*",
    errorNoCredits: "❌ *الرصيد غير كافٍ!* احصل على 🎁 المكافأة اليومية أو اشترك في ⭐ PRO.",
  },
  ru: {
    welcomeTitle: "⚡ *Универсальный Бот-Конвертер Файлов*",
    welcomeText: "Добро пожаловать! Отправьте любой файл или выберите инструмент ниже:",
    btnUrlMp3: "🔗 Ссылка в MP3",
    btnV2mp3: "🎥 Видео в MP3",
    btnV2gif: "🎬 Видео в GIF",
    btnImg2pdf: "📄 Фото в PDF",
    btnBgrem: "✂️ Удалить Фон",
    btnImgresize: "📐 Изменить Размер",
    btnImgcompress: "📉 Сжать Фото",
    btnPdf2txt: "📝 PDF в Текст",
    btnDocx2pdf: "📘 Word в PDF",
    btnImgconv: "🖼️ Конвертировать Фото",
    btnDaily: "🎁 Ежедневный Бонус",
    btnRef: "👥 Рефералы",
    btnUpgrade: "⭐ Купить Кредиты",
    btnProfile: "👤 Мой Аккаунт",
    btnLanguage: "🌐 Язык",
    taskSelected: "✅ *Выбрано:* {task}\n\n📥 Пожалуйста, отправьте ваш файл!",
    processing: "⏳ *Обработка файла: {task}...*",
    successResized: "📐 *Размер Изменен ({label})!*",
    successCompressed: "📉 *Фото Сжато ({sizeKb} КБ)!*",
    successBgRemoved: "✂️ *Фон Удален (PNG)!*",
    successFormatConv: "🖼️ *Формат Изменен!*",
    successPdf2Txt: "📝 *Текст Извлечен (OCR)!*",
    successText2Pdf: "📄 *Конвертировано в PDF!*",
    successAudioConv: "🎵 *Аудио Конвертировано!*",
    successVideo2Mp3: "🎵 *Видео Конвертировано в MP3!*",
    successVideo2Gif: "🎬 *Видео Конвертировано в GIF!*",
    errorNoCredits: "❌ *Недостаточно Кредитов!* Заберите 🎁 Бонус или купите ⭐ PRO.",
  },
  pt: {
    welcomeTitle: "⚡ *Bot Conversor de Arquivos Tudo-em-Um*",
    welcomeText: "Bem-vindo! Envie qualquer arquivo ou escolha uma ferramenta abaixo:",
    btnUrlMp3: "🔗 Link para MP3",
    btnV2mp3: "🎥 Vídeo para MP3",
    btnV2gif: "🎬 Vídeo para GIF",
    btnImg2pdf: "📄 Imagem para PDF",
    btnBgrem: "✂️ Remover Fundo",
    btnImgresize: "📐 Redimensionar Foto",
    btnImgcompress: "📉 Comprimir Foto",
    btnPdf2txt: "📝 PDF para Texto",
    btnDocx2pdf: "📘 Word para PDF",
    btnImgconv: "🖼️ Converter PNG/JPG",
    btnDaily: "🎁 Bônus Diário",
    btnRef: "👥 Indique e Ganhe",
    btnUpgrade: "⭐ Comprar Créditos",
    btnProfile: "👤 Minha Conta",
    btnLanguage: "🌐 Idioma",
    taskSelected: "✅ *Tarefa Selecionada:* {task}\n\n📥 Envie seu arquivo agora!",
    processing: "⏳ *Processando arquivo: {task}...*",
    successResized: "📐 *Imagem Redimensionada ({label})!*",
    successCompressed: "📉 *Foto Comprimida ({sizeKb} KB)!*",
    successBgRemoved: "✂️ *Fundo Removido (PNG)!*",
    successFormatConv: "🖼️ *Formato Convertido!*",
    successPdf2Txt: "📝 *Texto Extraído (OCR)!*",
    successText2Pdf: "📄 *Convertido para PDF!*",
    successAudioConv: "🎵 *Áudio Convertido!*",
    successVideo2Mp3: "🎵 *Vídeo Convertido para MP3!*",
    successVideo2Gif: "🎬 *Vídeo Convertido para GIF!*",
    errorNoCredits: "❌ *Créditos Insuficientes!* Resgate seu 🎁 Bônus ou compre ⭐ PRO.",
  },
  fr: {
    welcomeTitle: "⚡ *Bot Convertisseur de Fichiers Tout-en-Un*",
    welcomeText: "Bienvenue ! Envoyez un fichier ou choisissez un outil ci-dessous :",
    btnUrlMp3: "🔗 Lien vers MP3",
    btnV2mp3: "🎥 Vidéo en MP3",
    btnV2gif: "🎬 Vidéo en GIF",
    btnImg2pdf: "📄 Image en PDF",
    btnBgrem: "✂️ Supprimer le Fond",
    btnImgresize: "📐 Redimensionner Image",
    btnImgcompress: "📉 Compresser Photo",
    btnPdf2txt: "📝 PDF en Texte",
    btnDocx2pdf: "📘 Word en PDF",
    btnImgconv: "🖼️ Convertir PNG/JPG",
    btnDaily: "🎁 Bonus Quotidien",
    btnRef: "👥 Parrainage",
    btnUpgrade: "⭐ Acheter Crédits",
    btnProfile: "👤 Mon Compte",
    btnLanguage: "🌐 Langue",
    taskSelected: "✅ *Tâche Sélectionnée :* {task}\n\n📥 Envoyez votre fichier !",
    processing: "⏳ *Traitement du fichier : {task}...*",
    successResized: "📐 *Image Redimensionnée ({label}) !*",
    successCompressed: "📉 *Photo Compressée ({sizeKb} Ko) !*",
    successBgRemoved: "✂️ *Fond Supprimé (PNG) !*",
    successFormatConv: "🖼️ *Format Converti !*",
    successPdf2Txt: "📝 *Texte Extrait (OCR) !*",
    successText2Pdf: "📄 *Converti en PDF !*",
    successAudioConv: "🎵 *Audio Converti !*",
    successVideo2Mp3: "🎵 *Vidéo Convertie en MP3 !*",
    successVideo2Gif: "🎬 *Vidéo Convertie en GIF !*",
    errorNoCredits: "❌ *Crédits Insuffisants !* Réclamez votre 🎁 Bonus ou achetez ⭐ PRO.",
  }
};

/**
 * Detect user language code automatically from Telegram ctx or database
 */
function getUserLanguage(ctx) {
  if (!ctx || !ctx.from) return 'en';

  const userId = ctx.from.id;
  const user = db.getUser(userId, ctx.from.username);
  if (user && user.language && dictionary[user.language]) {
    return user.language;
  }

  const tgLang = (ctx.from.language_code || 'en').toLowerCase().split('-')[0];
  if (dictionary[tgLang]) {
    return tgLang;
  }

  return 'en';
}

/**
 * Get localized string with parameter interpolation
 */
function t(ctxOrLang, key, params = {}) {
  const lang = typeof ctxOrLang === 'string' ? ctxOrLang : getUserLanguage(ctxOrLang);
  const dict = dictionary[lang] || dictionary.en;
  let str = dict[key] || dictionary.en[key] || key;

  Object.keys(params).forEach((k) => {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), params[k]);
  });

  return str;
}

function setUserLanguage(userId, langCode) {
  if (!dictionary[langCode]) return false;
  const dbData = db.loadDb();
  if (dbData.users[userId]) {
    dbData.users[userId].language = langCode;
    db.saveDb(dbData);
    return true;
  }
  return false;
}

module.exports = {
  getUserLanguage,
  setUserLanguage,
  t,
  dictionary
};
