# Practice Chat / Whisper Flow — Hardening Checklist

Status: **planned, deferred** (Practice Chat is in active tutor use; do the staged rollout in a no-lessons window). Created 2026-06-18.

This is the execute-later checklist for securing the Practice Chat transcription ("Whisper") flow. Investigated 2026-06-18; agreed to defer the code changes so live tutor sessions aren't interrupted.

---

## Architecture (as found)

- **Client:** `github.com/FirstChord/practicechatpwa` — Firebase-hosted PWA, linked from the admin dashboard quick-link. Transcription code: `public/src/asr-client.js`.
- **Relay:** `github.com/FirstChord/enhanced-music-lesson-notes` — Railway service at `https://enhanced-music-lesson-notes-production.up.railway.app`. Holds `OPENAI_API_KEY`. Cloned **3×** locally under `~/Desktop/Tools:Games/FC Admin Tools/HW Notes 3 …` (all same `origin`; worth collapsing to one).
- **Transcription:** record (MediaRecorder, webm/opus) → on stop, batch call to OpenAI Whisper (`/v1/audio/transcriptions`, `whisper-1`). The relay also has legacy WebSocket/Realtime code that this PWA does **not** use.

## The problem

The PWA fetches the **raw `OPENAI_API_KEY` from the relay's `GET /api-key`** and calls OpenAI **directly from the browser** (`asr-client.js:148–164`). So the key is delivered to every client and is visible in browser network/devtools. The relay's origin checks are weak (allow no-origin and any `chrome-extension://`; `Origin` is spoofable), so the endpoint is effectively reachable by anyone who knows the URL.

**Impact:** anyone who can reach `/api-key` can extract the key and spend OpenAI credit. Confidentiality/cost risk, not an availability bug — current transcription works, which is why deferring is safe functionally.

---

## Do now — zero disruption (no code, no deploy)

- [ ] In the **OpenAI dashboard**, set a **monthly usage limit** + **email alert threshold**. Caps the blast radius if the exposed key is abused, and doubles as the low-credit warning. This is independent of all the code work below.

---

## Phase 1 — Close the key exposure (staged, zero-downtime)

Do in this order so no tutor mid-session is interrupted. Each push deploys (Railway / Firebase) — verify after each.

- [ ] **Relay (additive):** add `POST /transcribe` — accepts the audio blob, calls OpenAI Whisper **server-side** with the key, returns `{ text }`. Add a shared secret (mirror the dashboard's `PRACTICE_CHAT_API_SECRET` pattern) and tighten the CORS/origin allow-list. Do **not** remove `/api-key` yet.
- [ ] Deploy relay. Confirm old `/api-key` flow still works (old PWA unaffected) **and** `/transcribe` works.
- [ ] **PWA:** switch `asr-client.js` to POST the recorded blob to `relay/transcribe` (with the shared secret) instead of `getAPIKey()` + direct OpenAI call. Remove `getAPIKey()`.
- [ ] Deploy PWA. Tutors mid-session on the old PWA keep working until they reload, then get the new path.
- [ ] **Wait** until everyone is on the new PWA (a day, or confirm no `/api-key` hits in relay logs).
- [ ] **Relay:** remove the `GET /api-key` endpoint. Deploy.
- [ ] **Rotate `OPENAI_API_KEY`** — the old key is compromised (exposed in browsers/logs). **Do this in a no-lessons window**, since it instantly invalidates any client still using the old browser-side flow. Update the key in the relay's Railway env only (no other service should hold it).

## Phase 2 — Clear low-credit warnings (in code)

- [ ] In the relay's `/transcribe` handler, detect OpenAI quota/billing failures (`insufficient_quota`, HTTP 429, billing messages) and return a distinct, friendly message — e.g. *"Transcription paused — OpenAI credit needs topping up"* — instead of a generic error.
- [ ] (Optional) fire an admin notification (email/log) when that specific error is seen, so a mid-lesson failure surfaces immediately.

## Phase 3 — Open-source fallback if OpenAI is down

- [ ] In the PWA, when the relay `/transcribe` call fails, fall back to **in-browser open-source Whisper via Transformers.js** (`@xenova/transformers`, `whisper-tiny`/`whisper-base`, WASM). It transcribes the *same recorded blob* — no key, works offline, keeps the record→transcribe UX. First load downloads a small model (cached thereafter).
- [ ] (Alternative, lighter/lower-quality: Vosk WASM.)
- [ ] Note: the local `~/whisper-models` can't back a Railway service — a deployed fallback must be browser-side.

---

## Verification (each phase)

- [ ] Record → transcribe end-to-end in the PWA returns correct text.
- [ ] Relay logs show transcription happening **server-side**; no key in any client network request.
- [ ] After Phase 1: `GET /api-key` returns 404; browser never receives the key.
- [ ] After rotation: new key works; old key rejected.

## Housekeeping (when convenient)

- [ ] Collapse the 3 local relay clones (`HW Notes 3 …`) down to one working copy.
- [ ] Remove the unused legacy WebSocket/Realtime code from the relay if it's confirmed dead.
