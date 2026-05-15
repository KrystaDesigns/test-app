import fs from 'node:fs/promises';

export async function transcribeAudio(filePath, originalName, mimeType = 'application/octet-stream') {
  if (!process.env.OPENAI_API_KEY) {
    return buildMockTranscript(originalName);
  }

  const bytes = await fs.readFile(filePath);
  const body = new FormData();
  body.append('model', process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-transcribe');
  body.append('response_format', 'text');
  body.append('prompt', 'This is a business meeting or call recording. Preserve names, tasks, due dates, decisions, and important product or customer details.');
  body.append('file', new Blob([bytes], { type: mimeType }), originalName);

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body,
  });

  if (!response.ok) {
    throw new Error(`Transcription failed: ${await response.text()}`);
  }

  return response.text();
}

export async function summarizeTranscript(transcript, title) {
  if (!process.env.OPENAI_API_KEY) {
    return heuristicSummary(transcript, title);
  }

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'keyPoints', 'actionItems', 'decisions', 'followUpEmail'],
    properties: {
      summary: { type: 'string' },
      keyPoints: { type: 'array', items: { type: 'string' } },
      actionItems: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['owner', 'task', 'dueDate', 'status'],
          properties: {
            owner: { type: 'string' },
            task: { type: 'string' },
            dueDate: { type: 'string' },
            status: { type: 'string', enum: ['open', 'blocked', 'done'] },
          },
        },
      },
      decisions: { type: 'array', items: { type: 'string' } },
      followUpEmail: { type: 'string' },
    },
  };

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_SUMMARY_MODEL || 'gpt-4.1-mini',
      input: [
        { role: 'system', content: 'You convert meeting transcripts into concise business-ready minutes. Return only valid JSON that matches the requested schema.' },
        { role: 'user', content: `Meeting title: ${title}\n\nTranscript:\n${transcript}` },
      ],
      text: { format: { type: 'json_schema', name: 'meeting_summary', strict: true, schema } },
    }),
  });

  if (!response.ok) {
    throw new Error(`Summary generation failed: ${await response.text()}`);
  }

  const payload = await response.json();
  const outputText = payload.output_text || payload.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text;
  return JSON.parse(outputText);
}

function buildMockTranscript(originalName) {
  return [
    `Demo transcript for ${originalName}.`,
    'Asha opened the call by reviewing the uploaded recording workflow and requested automatic transcription after every upload.',
    'Ravi agreed that the tool must generate a short call summary, key decisions, and clear action points with owners and deadlines.',
    'Mina asked for sharing options so the summary can be sent by email, opened in WhatsApp, and downloaded as a PDF for records.',
    'The team decided to ship a first version with upload, transcript review, generated meeting notes, and export/share actions.',
    'Ravi will connect a production speech-to-text provider. Asha will validate the PDF template. Mina will prepare recipient lists before launch.',
  ].join(' ');
}

function heuristicSummary(transcript, title) {
  const sentences = transcript.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
  const summarySentences = sentences.slice(0, 3);
  const actionHints = sentences.filter((sentence) => /\b(will|must|need|action|follow|prepare|connect|validate|send|create)\b/i.test(sentence));

  return {
    summary: summarySentences.join(' ') || `The meeting "${title}" was processed. Add an OpenAI API key to generate a richer AI summary from real uploaded audio.`,
    keyPoints: sentences.slice(0, 5).map(stripTrailingPunctuation),
    actionItems: (actionHints.length ? actionHints : sentences.slice(0, 3)).slice(0, 4).map((sentence, index) => ({
      owner: inferOwner(sentence) || `Owner ${index + 1}`,
      task: stripTrailingPunctuation(sentence),
      dueDate: 'Not specified',
      status: 'open',
    })),
    decisions: sentences.filter((sentence) => /\b(decided|agreed|approved|selected|confirmed)\b/i.test(sentence)).slice(0, 4).map(stripTrailingPunctuation),
    followUpEmail: buildFollowUpEmail(title, summarySentences, actionHints),
  };
}

function inferOwner(sentence) {
  const match = sentence.match(/^([A-Z][a-z]+)\b/);
  return match?.[1] || '';
}

function stripTrailingPunctuation(sentence) {
  return sentence.replace(/[.!?]+$/, '');
}

function buildFollowUpEmail(title, summarySentences, actionHints) {
  const summary = summarySentences.join(' ') || 'The meeting audio was processed successfully.';
  const actions = actionHints.length ? actionHints.map((item) => `- ${stripTrailingPunctuation(item)}`).join('\n') : '- No explicit action items were detected.';
  return `Subject: Follow-up notes for ${title}\n\nHi team,\n\nHere is the meeting summary:\n${summary}\n\nAction items:\n${actions}\n\nRegards,\nMeeting Audio Tool`;
}
