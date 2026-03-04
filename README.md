# Local AI Notetaker (Fireflies-style Replica)

A lightweight local web app that mimics core AI notetaker workflows:

- Join live meetings by pasting a **Zoom**, **Google Meet**, or **Zoho Meeting** link.
- Record meetings live with a built-in **screen + audio recorder**.
- Paste transcript/notes and generate local **summary**, **action items**, and **keywords**.

## Run locally

Because the app uses browser APIs (`getDisplayMedia`, `MediaRecorder`), run it through a local server.

```bash
python3 -m http.server 4173
```

Then open:

- `http://localhost:4173`

## Notes

- Recording permissions are controlled by your browser.
- Meeting links are opened in a new tab via `window.open`.
- This is an offline/local-first UI replica, not a production bot integration.
