Lola Backend (minimal)

This is a minimal TypeScript Express backend scaffold for the Lola tutor app.

Quick start

1. Copy `.env.example` to `.env` and set `MONGO_URI` and `OPENAI_API_KEY`.
2. Install: `npm install`
3. Run backend in dev (live reload via ts-node-dev):

```powershell
npm run dev
```

Frontend (Expo) with Fast Refresh:

```powershell
cd expo-app
npm install
npm run dev
```

API

POST /api/v1/chat/send
body: { text: string, mode: 'm1'|'m2'|'m3' }

Notes

- Uses MongoDB (mongoose) to store messages.
- `src/utils/prompt.ts` contains the master system prompt and mode injectors.

