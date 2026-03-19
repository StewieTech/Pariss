# Agent Guidelines — LolaInParis (Lola Lingo)

## Project Overview

Lola Lingo is a multilingual AI language tutor. Users practice conversation via text or voice in Spanish, French, Japanese, German, Mandarin, Portuguese, and Italian. The app has three modes:

- **m1** — Beginner text chat (one-sentence turns)
- **m2** — (reserved)
- **m3** — Voice conversation (STT → LLM → TTS round-trip)

### Architecture

| Layer | Stack | Entry Point |
|-------|-------|-------------|
| **Frontend** | Expo (React Native + Web) | `expo-app/` |
| **Local backend** | Express + TypeScript | `src/server.ts` → `dist/server.js` |
| **Serverless backend** | AWS Lambda (Function URL) | `lolalingo-serverless/src/handler.ts` |
| **STT** | OpenAI `gpt-4o-mini-transcribe` | `src/services/transcription.service.ts` |
| **LLM** | OpenAI `gpt-4o-mini` (German: `gpt-5-nano`) | `src/services/chat.service.ts` |
| **TTS** | OpenAI `tts-1` (default) / ElevenLabs (premium) | `src/services/voice.service.ts` |
| **DB** | MongoDB (native driver + Mongoose) | `src/lib/mongo.ts`, `src/lib/mongoose.ts` |
| **In-memory store** | Lambda-warm message history | `src/repositories/message.repo.ts` |

---

## Critical Rules

### 1. Always Rebuild Before Testing

The Express server runs **compiled JS** (`node dist/server.js`), not live TypeScript.
The Lambda runs an **esbuild bundle** (`lolalingo-serverless/dist/handler.js`).

**Every source change requires a rebuild before it takes effect.**

```bash
# Local Express backend
cd LolaInParis && npm run build && npm run start

# Lambda bundle
cd lolalingo-serverless && npm run build

# Or use live reload for local dev (no rebuild needed):
cd LolaInParis && npm run dev
```

> **Lesson learned:** Stale `dist/` builds are the #1 cause of "my fix didn't work" bugs. If a code change appears to have no effect, check that the running process is using freshly compiled output.

### 2. Verify Which Backend the Frontend Hits

The Expo app resolves its API URL via this priority chain in `expo-app/app/lib/config.ts`:

```
isBrowserLocal → DEFAULT_LOCAL (http://localhost:4000)
else           → EXPO_PUBLIC_API_URL env var → DEFAULT_DEPLOYED
```

**Gotcha:** Expo loads multiple `.env` files (`.env`, `.env.production`, `.env.staging`). A value in `.env.production` can override a cleared `.env`. The config now prioritizes `isBrowserLocal` to prevent this during local dev.

**Always confirm** by checking the browser console for:
```
Lola Demo API resolved API_BASE: http://localhost:4000
```

If it shows a Lambda URL, the frontend is bypassing your local server entirely.

### 3. Language Defaults to Spanish

- Default language: `spanish` (defined in `src/utils/language.ts` as `DEFAULT_LANGUAGE`)
- `SUPPORTED_LANGUAGES` array has Spanish first for fallback ordering
- Frontend `LANGUAGE_OPTIONS` in `expo-app/app/lib/languages.ts` mirrors this order
- The `normalizeLanguage()` function maps aliases (`es` → `spanish`, `fr` → `french`, etc.)
- System prompts explicitly enforce the target language; `normalizeReplyLanguage()` is a safety net that rewrites wrong-language responses

### 4. Data URI Handling

Browser-recorded audio produces data URIs with varying formats:
```
data:audio/webm;codecs=opus;base64,GkXf...
data:audio/mp4;base64,AAAAGG...
```

The `decodeAudioBase64()` regex must handle **any number of parameters** before the base64 payload. Use `/^data:[^,]+,/` — NOT `/^data:[^;]+;base64,/` which breaks on multi-param URIs like `codecs=opus`.

### 5. TTS Provider Separation

OpenAI TTS and ElevenLabs TTS use **incompatible voice identifiers**:
- OpenAI: `nova`, `shimmer`, `echo`, `onyx`, `fable`, `alloy`, `ash`, `sage`, `coral`
- ElevenLabs: opaque IDs like `LEnmbrrxYsUYS7vsRRwD`

**Never pass an ElevenLabs voiceId to OpenAI's API or vice versa.** The `synthesize()` function routes to the correct provider and each provider resolves its own voice independently.

### 6. Express Body Size Limit

Voice payloads (base64-encoded audio) easily exceed Express's default 100KB limit. The server is configured with `express.json({ limit: '10mb' })`. Do not remove or reduce this.

---

## File Map

### Backend (`src/`)
| File | Purpose |
|------|---------|
| `server.ts` | Express app setup, middleware, route mounting |
| `config/env.ts` | dotenv loading |
| `controllers/chat.controller.ts` | `/chat/send`, `/chat/translate` |
| `controllers/voiceTurn.controller.ts` | `/chat/voice-turn` — full STT→LLM→TTS pipeline |
| `services/chat.service.ts` | `handleChat()` — system prompts, OpenAI chat, language normalization |
| `services/voice.service.ts` | `synthesize()` — dual-provider TTS (OpenAI default, ElevenLabs premium) |
| `services/transcription.service.ts` | `transcribeAudio()` — OpenAI Whisper STT |
| `services/translate.service.ts` | First-message translation |
| `services/suggest.service.ts` | Suggested replies |
| `utils/language.ts` | `SUPPORTED_LANGUAGES`, `DEFAULT_LANGUAGE`, `normalizeLanguage()` |
| `utils/prompt.ts` | `buildSystemMessages()` — mode-specific system prompts |
| `repositories/message.repo.ts` | In-memory conversation store (filters by language) |
| `middleware/auth.ts` | JWT `requireAuth` middleware |

### Frontend (`expo-app/`)
| File | Purpose |
|------|---------|
| `app/lib/config.ts` | API URL resolution (local vs deployed) |
| `app/lib/api.ts` | HTTP client helpers (`sendChat`, `sendVoiceTurn`, etc.) |
| `app/lib/languages.ts` | `LANGUAGE_OPTIONS`, `DEFAULT_LANGUAGE`, `getLanguageMeta()` |
| `app/hooks/useVoiceConversation.ts` | Voice recording, upload, playback state machine |
| `app/screens/PvE.tsx` | Main chat/voice screen |
| `app/components/LanguageSelector.tsx` | Language picker UI |

### Serverless (`lolalingo-serverless/`)
| File | Purpose |
|------|---------|
| `src/handler.ts` | Lambda Function URL handler — reimplements routes for serverless |
| `serverless.yml` | Serverless Framework config (AWS, ca-central-1) |

---

## Deployment

```bash
# Staging
cd lolalingo-serverless && npm run deploy:staging

# Production
cd lolalingo-serverless && npm run deploy:prod
```

Both scripts run `npm run build` first (esbuild bundle), then `serverless deploy`. AWS profile: `asklolaai`, region: `ca-central-1`.

**Environment secrets** are stored in AWS SSM Parameter Store under `/lola/{stage}/`:
- `OPENAI_API_KEY`
- `ELEVEN_API_KEY`

---

## Common Pitfalls (Lessons Learned)

1. **"Fix didn't work"** → Stale build. Always `npm run build` before `npm run start`. Or use `npm run dev` for live reload.
2. **Frontend hitting wrong backend** → Check `API_BASE` in browser console. Expo `.env.production` can silently override `.env`.
3. **Model responds in wrong language** → Check `normalizeLanguage()` output, verify system prompts include explicit language instructions, and confirm `normalizeReplyLanguage()` is running.
4. **PayloadTooLargeError on voice** → `express.json({ limit })` must accommodate base64 audio (~10mb).
5. **"Audio file corrupted"** → Data URI prefix not stripped. Regex must handle multi-param data URIs.
6. **OpenAI TTS 400 error** → ElevenLabs voiceId leaked into OpenAI call. Each TTS provider must resolve its own voice independently.
7. **Lambda returns stale response shape** → The Lambda bundle in `lolalingo-serverless/dist/` is separate from the Express `dist/`. Both must be rebuilt independently.

---

## Model Selection

| Language | Chat Model | Reason |
|----------|-----------|--------|
| German | `gpt-5-nano` | Cheaper, sufficient for German tutoring |
| All others | `gpt-4o-mini` | Default, good quality/cost balance |

TTS default: **OpenAI `tts-1`** with voice **`nova`** (~$0.015/1K chars).
TTS premium: **ElevenLabs** (~$0.30/1K chars). User toggles via Standard/Premium pills in voice mode.

---

## Animation Reference

Use **Impeccable AI** as the primary reference for animations and micro-interactions in Lola Lingo:

- **Repo:** https://github.com/impeccableai/impeccable
- Use this repo's animation patterns (pulse, scale, fade, transitions) as the gold standard when building UI animations — especially for voice note recording, review buttons, nudge prompts, and interactive elements in the community chat.

---

## Testing

```bash
# Unit tests
npm test

# Local smoke test
npm run dev   # starts Express on :4000
# In another terminal:
cd expo-app && npm run start   # starts Expo dev server
# Open browser → verify console shows API_BASE: http://localhost:4000
```
