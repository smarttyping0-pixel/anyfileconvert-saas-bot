// Initialize Telegram WebApp SDK
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

// Global User Info from Telegram WebApp
const initDataUnsafe = tg?.initDataUnsafe || {};
const telegramUser = initDataUnsafe.user || { id: 'demo_user', username: 'DemoUser' };

document.addEventListener('DOMContentLoaded', () => {
  // Update Profile Info
  document.getElementById('profileUsername').textContent = `@${telegramUser.username || telegramUser.first_name || 'User'}`;

  // Tab Switching
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetTab = btn.getAttribute('data-tab');
      document.getElementById(`tab-${targetTab}`).classList.add('active');
    });
  });

  // File Input Drag & Drop Display
  const fileInput = document.getElementById('fileInput');
  const selectedFileName = document.getElementById('selectedFileName');

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      selectedFileName.textContent = `📄 Selected: ${fileInput.files[0].name}`;
      selectedFileName.style.color = '#10b981';
    }
  });

  // Convert File Action
  const convertBtn = document.getElementById('convertBtn');
  const taskSelect = document.getElementById('taskSelect');
  const progressBox = document.getElementById('progressBox');
  const resultCard = document.getElementById('resultCard');
  const resultFileName = document.getElementById('resultFileName');
  const downloadBtn = document.getElementById('downloadBtn');

  convertBtn.addEventListener('click', async () => {
    if (!fileInput.files || fileInput.files.length === 0) {
      alert('Please select a file first!');
      return;
    }

    const file = fileInput.files[0];
    const task = taskSelect.value;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('task', task);
    formData.append('userId', telegramUser.id);

    progressBox.classList.remove('hidden');
    resultCard.classList.add('hidden');
    convertBtn.disabled = true;

    try {
      const response = await fetch('/api/convert', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Conversion failed');
      }

      resultFileName.textContent = data.fileName;
      downloadBtn.href = data.downloadUrl;
      resultCard.classList.remove('hidden');

      // Deduct credit visually
      const count = parseInt(document.getElementById('creditCount').textContent, 10);
      if (count > 0) {
        document.getElementById('creditCount').textContent = count - 1;
        document.getElementById('statCredits').textContent = count - 1;
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      progressBox.classList.add('hidden');
      convertBtn.disabled = false;
    }
  });

  // URL Video to MP3 Action
  const urlInput = document.getElementById('urlInput');
  const urlConvertBtn = document.getElementById('urlConvertBtn');
  const urlProgressBox = document.getElementById('urlProgressBox');
  const urlResultCard = document.getElementById('urlResultCard');
  const urlDownloadBtn = document.getElementById('urlDownloadBtn');

  urlConvertBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
      alert('Please paste a valid video URL link!');
      return;
    }

    urlProgressBox.classList.remove('hidden');
    urlResultCard.classList.add('hidden');
    urlConvertBtn.disabled = true;

    try {
      const response = await fetch('/api/convert-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, userId: telegramUser.id })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'URL conversion failed');
      }

      urlDownloadBtn.href = data.downloadUrl;
      urlResultCard.classList.remove('hidden');
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      urlProgressBox.classList.add('hidden');
      urlConvertBtn.disabled = false;
    }
  });

  // Daily Bonus Action
  const claimDailyBtn = document.getElementById('claimDailyBtn');
  claimDailyBtn?.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/daily-bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: telegramUser.id })
      });
      const data = await response.json();
      alert(data.message);
    } catch (e) {
      alert('Failed to claim bonus');
    }
  });

  // Referral Action
  const shareRefBtn = document.getElementById('shareRefBtn');
  shareRefBtn?.addEventListener('click', () => {
    const refLink = `https://t.me/AnyFileConvertProBot?start=ref_${telegramUser.id}`;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent("Convert files, images, PDFs & videos instantly!")}`);
    } else {
      navigator.clipboard.writeText(refLink);
      alert('Referral link copied to clipboard!');
    }
  });
});
