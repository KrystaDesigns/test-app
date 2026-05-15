const form = document.querySelector('#upload-form');
const audioInput = document.querySelector('#audio');
const titleInput = document.querySelector('#title');
const submitButton = document.querySelector('#submit-button');
const fileName = document.querySelector('#file-name');
const statusText = document.querySelector('#status-text');
const errorText = document.querySelector('#error-text');
const results = document.querySelector('#results');
const modePill = document.querySelector('#mode-pill');

let selectedFile = null;
let currentMeeting = null;

fetch('/api/health')
  .then((response) => response.json())
  .then((health) => {
    modePill.textContent = health.aiMode === 'openai' ? 'AI enabled' : 'Demo mode';
  })
  .catch(() => {
    modePill.textContent = 'Ready';
  });

audioInput.addEventListener('change', () => {
  selectedFile = audioInput.files?.[0] || null;
  fileName.textContent = selectedFile ? selectedFile.name : 'Choose MP3, WAV, M4A, WebM, or MP4 audio';
  submitButton.disabled = !selectedFile;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedFile) return;

  setLoading(true, 'Uploading and transcribing your meeting audio...');
  errorText.textContent = '';

  try {
    const audioBase64 = await fileToBase64(selectedFile);
    const response = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: titleInput.value || selectedFile.name,
        fileName: selectedFile.name,
        mimeType: selectedFile.type || 'application/octet-stream',
        audioBase64,
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Failed to process meeting.');
    currentMeeting = payload;
    renderMeeting(payload);
    statusText.textContent = 'Transcript, summary, action items, and sharing options are ready.';
  } catch (error) {
    errorText.textContent = error.message || 'Something went wrong.';
    statusText.textContent = 'Upload failed. Please try again.';
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading, message) {
  submitButton.disabled = isLoading || !selectedFile;
  submitButton.textContent = isLoading ? 'Generating transcript and summary…' : 'Transcribe and summarize';
  if (message) statusText.textContent = message;
}

function renderMeeting(meeting) {
  results.classList.remove('hidden');
  results.innerHTML = `
    <article class="panel result-card wide">
      <h2>${escapeHtml(meeting.title)}</h2>
      <p class="meta">Processed ${new Date(meeting.createdAt).toLocaleString()} from ${escapeHtml(meeting.fileName)}</p>
      <h3>Call summary</h3>
      <p>${escapeHtml(meeting.summary)}</p>
    </article>
    <article class="panel result-card">
      <h3>Action points</h3>
      <ul class="task-list">${meeting.actionItems.map(renderActionItem).join('')}</ul>
    </article>
    <article class="panel result-card">
      <h3>Key discussion points</h3>
      <ul>${meeting.keyPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>
      <h3>Decisions</h3>
      <ul>${(meeting.decisions.length ? meeting.decisions : ['No explicit decisions detected.']).map((decision) => `<li>${escapeHtml(decision)}</li>`).join('')}</ul>
    </article>
    <article class="panel result-card wide">
      <h3>Share and export</h3>
      <div class="share-row">
        <input id="email-to" placeholder="recipient@example.com" />
        <button type="button" data-share="email">Send as email</button>
      </div>
      <div class="share-row">
        <input id="whatsapp-phone" placeholder="WhatsApp phone with country code" />
        <button type="button" data-share="whatsapp">Send to WhatsApp</button>
      </div>
      <a class="download-button" href="/api/meetings/${meeting.id}/pdf">Download PDF</a>
    </article>
    <article class="panel result-card wide">
      <h3>Transcript</h3>
      <pre>${escapeHtml(meeting.transcript)}</pre>
    </article>
  `;

  results.querySelector('[data-share="email"]').addEventListener('click', () => openShare('email'));
  results.querySelector('[data-share="whatsapp"]').addEventListener('click', () => openShare('whatsapp'));
}

function renderActionItem(item) {
  return `
    <li>
      <span>${escapeHtml(item.owner)}</span>
      <strong>${escapeHtml(item.task)}</strong>
      <small>Due: ${escapeHtml(item.dueDate)} · ${escapeHtml(item.status)}</small>
    </li>
  `;
}

async function openShare(kind) {
  if (!currentMeeting) return;
  const body = kind === 'email'
    ? { to: document.querySelector('#email-to').value }
    : { phone: document.querySelector('#whatsapp-phone').value };
  const response = await fetch(`/api/meetings/${currentMeeting.id}/share/${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) {
    errorText.textContent = payload.error || `Could not create ${kind} share link.`;
    return;
  }
  window.open(payload.url, '_blank', 'noopener,noreferrer');
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
