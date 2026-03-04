const meetingForm = document.querySelector('#meeting-form');
const meetingLinkInput = document.querySelector('#meeting-link');
const platformSelect = document.querySelector('#platform');
const joinStatus = document.querySelector('#join-status');

const startBtn = document.querySelector('#start-rec');
const pauseBtn = document.querySelector('#pause-rec');
const resumeBtn = document.querySelector('#resume-rec');
const stopBtn = document.querySelector('#stop-rec');
const recState = document.querySelector('#rec-state');
const recTime = document.querySelector('#rec-time');
const downloadLink = document.querySelector('#download-link');

const transcriptInput = document.querySelector('#transcript');
const generateBtn = document.querySelector('#generate');
const clearBtn = document.querySelector('#clear');
const summaryList = document.querySelector('#summary-list');
const actionList = document.querySelector('#action-list');
const keywordList = document.querySelector('#keyword-list');

let mediaRecorder;
let recordingChunks = [];
let timerId;
let elapsedSeconds = 0;
let activeStreams = [];

const formatTime = (seconds) => {
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${secs}`;
};

const detectPlatform = (link) => {
  if (/zoom\./i.test(link)) return 'zoom';
  if (/meet\.google\./i.test(link)) return 'meet';
  if (/zoho/i.test(link)) return 'zoho';
  return null;
};

meetingForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const link = meetingLinkInput.value.trim();
  const chosen = platformSelect.value;
  const detected = detectPlatform(link);
  const platform = chosen === 'auto' ? detected : chosen;

  if (!platform) {
    joinStatus.textContent = 'Could not detect platform. Pick one manually.';
    return;
  }

  joinStatus.textContent = `Opening ${platform.toUpperCase()} meeting...`;
  window.open(link, '_blank', 'noopener,noreferrer');
});

const setState = (text, isRecording = false) => {
  recState.textContent = text;
  recState.classList.toggle('recording', isRecording);
};

const stopAllTracks = () => {
  activeStreams.forEach((stream) => {
    stream.getTracks().forEach((track) => track.stop());
  });
  activeStreams = [];
};

startBtn.addEventListener('click', async () => {
  try {
    downloadLink.classList.add('hidden');
    recordingChunks = [];
    elapsedSeconds = 0;
    recTime.textContent = formatTime(0);

    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });

    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    activeStreams = [displayStream, micStream];

    const mixedStream = new MediaStream([
      ...displayStream.getVideoTracks(),
      ...displayStream.getAudioTracks(),
      ...micStream.getAudioTracks(),
    ]);

    mediaRecorder = new MediaRecorder(mixedStream, { mimeType: 'video/webm' });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordingChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordingChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      downloadLink.classList.remove('hidden');
      setState('Stopped');
      stopAllTracks();
    };

    mediaRecorder.start(1000);
    setState('Recording', true);

    timerId = setInterval(() => {
      elapsedSeconds += 1;
      recTime.textContent = formatTime(elapsedSeconds);
    }, 1000);

    startBtn.disabled = true;
    pauseBtn.disabled = false;
    stopBtn.disabled = false;
  } catch (error) {
    setState('Permission denied or recording unavailable');
  }
});

pauseBtn.addEventListener('click', () => {
  if (!mediaRecorder || mediaRecorder.state !== 'recording') return;
  mediaRecorder.pause();
  clearInterval(timerId);
  setState('Paused');
  pauseBtn.disabled = true;
  resumeBtn.disabled = false;
});

resumeBtn.addEventListener('click', () => {
  if (!mediaRecorder || mediaRecorder.state !== 'paused') return;
  mediaRecorder.resume();
  timerId = setInterval(() => {
    elapsedSeconds += 1;
    recTime.textContent = formatTime(elapsedSeconds);
  }, 1000);
  setState('Recording', true);
  pauseBtn.disabled = false;
  resumeBtn.disabled = true;
});

stopBtn.addEventListener('click', () => {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
  mediaRecorder.stop();
  clearInterval(timerId);
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  resumeBtn.disabled = true;
  stopBtn.disabled = true;
});

const tokenize = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3);

const getKeywords = (text, limit = 8) => {
  const counts = {};
  tokenize(text).forEach((word) => {
    counts[word] = (counts[word] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => `${word} (${count})`);
};

const toBullets = (text, limit = 5) =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limit);

const getActions = (text) =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => /\b(will|owner|todo|action|next|follow up|deadline|due)\b/i.test(line));

const renderList = (element, items) => {
  element.innerHTML = '';
  if (!items.length) {
    const li = document.createElement('li');
    li.textContent = 'No data yet.';
    element.append(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    element.append(li);
  });
};

generateBtn.addEventListener('click', () => {
  const text = transcriptInput.value.trim();
  if (!text) return;
  renderList(summaryList, toBullets(text));
  renderList(actionList, getActions(text));
  renderList(keywordList, getKeywords(text));
});

clearBtn.addEventListener('click', () => {
  transcriptInput.value = '';
  [summaryList, actionList, keywordList].forEach((list) => {
    list.innerHTML = '';
  });
});
