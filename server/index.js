import http from 'node:http';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { summarizeTranscript, transcribeAudio } from './ai.js';
import { createMeetingPdf } from './pdf.js';

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const uploadDir = path.join(rootDir, 'uploads');
const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '0.0.0.0';
const meetings = new Map();

await fs.mkdir(uploadDir, { recursive: true });

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {});
      return;
    }

    if (url.pathname === '/api/health' && req.method === 'GET') {
      sendJson(res, 200, { ok: true, aiMode: process.env.OPENAI_API_KEY ? 'openai' : 'demo' });
      return;
    }

    if (url.pathname === '/api/meetings' && req.method === 'POST') {
      const payload = await readJson(req);
      const meeting = await processMeeting(payload);
      sendJson(res, 201, meeting);
      return;
    }

    const meetingMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)(?:\/(pdf|share\/email|share\/whatsapp))?$/);
    if (meetingMatch) {
      await handleMeetingRoute(req, res, meetingMatch[1], meetingMatch[2]);
      return;
    }

    await serveStatic(url.pathname, res);
  } catch (error) {
    console.error(error);
    sendJson(res, error.statusCode || 500, { error: error.message || 'Unexpected server error.' });
  }
});

server.listen(port, host, () => {
  console.log('Meeting Audio Tool server is running.');
  console.log(`Local:   http://localhost:${port}`);
  console.log(`Network: http://${host}:${port}`);
  console.log('Keep this terminal open while using the app.');
});

async function processMeeting(payload) {
  if (!payload.audioBase64 || !payload.fileName) {
    const error = new Error('Audio file is required.');
    error.statusCode = 400;
    throw error;
  }

  const id = crypto.randomUUID();
  const fileName = path.basename(payload.fileName);
  const uploadPath = path.join(uploadDir, `${id}-${fileName}`);
  await fs.writeFile(uploadPath, Buffer.from(payload.audioBase64, 'base64'));

  const title = String(payload.title || fileName || 'Untitled meeting').trim();
  const transcript = await transcribeAudio(uploadPath, fileName, payload.mimeType);
  const summary = await summarizeTranscript(transcript, title);
  const meeting = {
    id,
    title,
    fileName,
    createdAt: new Date().toISOString(),
    transcript,
    ...summary,
  };
  meetings.set(id, meeting);
  return meeting;
}

async function handleMeetingRoute(req, res, id, action) {
  const meeting = meetings.get(id);
  if (!meeting) {
    sendJson(res, 404, { error: 'Meeting not found.' });
    return;
  }

  if (!action && req.method === 'GET') {
    sendJson(res, 200, meeting);
    return;
  }

  if (action === 'pdf' && req.method === 'GET') {
    const pdf = createMeetingPdf(meeting);
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeFileName(meeting.title)}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
    return;
  }

  if (action === 'share/email' && req.method === 'POST') {
    const body = await readJson(req).catch(() => ({}));
    const to = String(body.to || '').trim();
    const subject = `Meeting notes: ${meeting.title}`;
    sendJson(res, 200, { url: `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildShareText(meeting))}` });
    return;
  }

  if (action === 'share/whatsapp' && req.method === 'POST') {
    const body = await readJson(req).catch(() => ({}));
    const phone = String(body.phone || '').replace(/\D/g, '');
    const text = encodeURIComponent(buildShareText(meeting));
    sendJson(res, 200, { url: phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}` });
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed.' });
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': process.env.CLIENT_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

async function serveStatic(requestPath, res) {
  const normalizedPath = requestPath === '/' ? '/index.html' : requestPath;
  const filePath = path.resolve(rootDir, `.${normalizedPath}`);
  if (!filePath.startsWith(rootDir)) {
    sendJson(res, 403, { error: 'Forbidden.' });
    return;
  }
  try {
    const file = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType(filePath) });
    res.end(file);
  } catch {
    const index = await fs.readFile(path.join(rootDir, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(index);
  }
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html';
  if (filePath.endsWith('.css')) return 'text/css';
  if (filePath.endsWith('.js')) return 'text/javascript';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

function buildShareText(meeting) {
  const actions = meeting.actionItems.length
    ? meeting.actionItems.map((item) => `- ${item.owner}: ${item.task} (${item.dueDate})`).join('\n')
    : '- No action items detected.';
  return [
    `Meeting notes: ${meeting.title}`,
    '',
    'Summary:',
    meeting.summary,
    '',
    'Key points:',
    ...meeting.keyPoints.map((point) => `- ${point}`),
    '',
    'Action items:',
    actions,
  ].join('\n');
}

function safeFileName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'meeting-notes';
}

function loadEnv() {
  const env = path.resolve(process.cwd(), '.env');
  if (!fsSync.existsSync(env)) return;
  const content = fsSync.readFileSync(env, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...valueParts] = trimmed.split('=');
    if (key && !process.env[key]) process.env[key] = valueParts.join('=');
  });
}
