# AI Flow Studio — Phase 1

Local React + TypeScript and Fastify workspace with embedded draw.io editor. OpenAI/Claude are planned Phase 2 adapters (no API calls yet).

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173; Fastify health: http://127.0.0.1:3001/health.

## Features

- Embedded diagrams.net editor (requires internet to load)
- Import/export `.drawio` XML
- Local browser save and revision number
- Chat panel and Discuss/Auto/Review mode placeholders

Do not commit `.env` or API keys.
