import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeTranscript, transcribeAudio } from './ai.js';

test('returns a demo transcript when no provider key is configured', async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const transcript = await transcribeAudio('/tmp/not-used.wav', 'demo-call.wav');
  if (previousKey) process.env.OPENAI_API_KEY = previousKey;
  else delete process.env.OPENAI_API_KEY;

  assert.match(transcript, /Demo transcript for demo-call\.wav/);
  assert.match(transcript, /automatic transcription/);
});

test('builds a useful summary structure from transcript text', async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const summary = await summarizeTranscript(
    'Asha reviewed the upload workflow. Ravi will connect production transcription by Friday. The team decided to ship PDF export.',
    'Product sync',
  );
  if (previousKey) process.env.OPENAI_API_KEY = previousKey;
  else delete process.env.OPENAI_API_KEY;

  assert.match(summary.summary, /Asha reviewed/);
  assert.ok(summary.keyPoints.length > 0);
  assert.equal(summary.actionItems[0].status, 'open');
  assert.match(summary.decisions[0], /decided/);
});
