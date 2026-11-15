# AI Flow Studio — Phase 2

React + TypeScript, Fastify, diagrams.net Embed, and AI chat with OpenAI and Claude.

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173. Backend health: http://127.0.0.1:3001/health.

Choose OpenAI or Claude, enter that provider's API key in the sidebar (or set `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` in the local `.env`), and choose:

- **Discuss:** AI discusses your diagram without changing it.
- **Auto:** AI returns a complete draw.io XML diagram and applies it to the local document.
- **Review:** AI proposes XML changes; approve or reject before applying.

Open the draw.io editor to see and manually edit the result. Export `.drawio` to save a portable file.

**Security:** Never commit `.env` or keys. Browser-entered keys are held in React memory and sent to your local Fastify server for outbound API calls. The local backend binds to 127.0.0.1. Browser keys disappear on refresh. The app does not persist chat history. API usage is billed separately from ChatGPT/Claude subscriptions.

**Limitations:** Phase 2 AI returns a complete diagram XML, not deterministic node-by-node patches. Existing styles/positions are requested to be preserved but not guaranteed. Review changes before applying to important diagrams. The embedded diagrams.net editor requires internet. No production deployment, authentication, server-side secret vault, or collaboration is included. XML generation may need retry for complex diagrams.
