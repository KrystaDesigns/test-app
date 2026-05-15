# Meeting Audio Tool

A dependency-light full-stack application for uploading a meeting or call recording, generating a transcript, creating a concise summary with action points, and sharing the result by email, WhatsApp, or PDF download.

## Features

- Audio upload from the browser.
- Automatic transcription after upload.
- Meeting summary, key points, decisions, and action items.
- Email compose link and WhatsApp share link.
- PDF export endpoint.
- Demo mode when no AI key is configured, so the application can be run locally immediately.
- Optional OpenAI integration for production transcription and structured summaries.

## Run locally

```bash
npm run dev
```

Keep that terminal window open, then open <http://localhost:4000> in your browser. The server prints the exact local URL when it is ready.

If you are running this inside a cloud IDE, container, Codespace, or VM, make sure port `4000` is forwarded/exposed by that environment. In those environments, your laptop browser cannot connect to `localhost:4000` unless the server process is still running and the port is forwarded to your machine.

## Fix `localhost refused to connect`

That browser message means there is no reachable server listening at the URL you opened. Check the following:

1. Start the app with `npm run dev` from this repository folder.
2. Wait until the terminal prints `Meeting Audio Tool server is running.` and `Local: http://localhost:4000`.
3. Keep the terminal running while you use the app. If the command stops, refreshes will fail with `ERR_CONNECTION_REFUSED`.
4. If port `4000` is already used, run `PORT=4100 npm run dev` and open <http://localhost:4100>.
5. If you are in a remote/container environment, use its forwarded-port URL for port `4000` instead of your computer's plain `localhost`.
6. You can verify the backend is up by running `curl http://localhost:4000/api/health`; it should return JSON like `{"ok":true,"aiMode":"demo"}`.

## Optional AI configuration

Copy `.env.example` to `.env` and add an API key to enable real transcription and summarization:

```bash
OPENAI_API_KEY=your_api_key
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-transcribe
OPENAI_SUMMARY_MODEL=gpt-4.1-mini
```

Without `OPENAI_API_KEY`, the backend returns a demo transcript and a heuristic summary so the workflow remains testable.

## API

- `GET /api/health` checks service health and whether AI mode is enabled.
- `POST /api/meetings` accepts JSON with `title`, `fileName`, `mimeType`, and base64 `audioBase64`.
- `GET /api/meetings/:id` returns generated meeting notes.
- `GET /api/meetings/:id/pdf` downloads a PDF report.
- `POST /api/meetings/:id/share/email` returns a `mailto:` compose URL.
- `POST /api/meetings/:id/share/whatsapp` returns a WhatsApp share URL.
