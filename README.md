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

## File workflow

- **New:** reset the diagram (confirmation required).
- **Open File:** choose an existing `.drawio` or `.xml` file. Chrome/Edge can retain a file handle; other browsers use file upload.
- **Save:** write to the opened/previously saved file when the browser File System Access API is supported. Otherwise download a new `.drawio` file.
- **Save As:** choose a different file destination where supported, otherwise download.
- **Download:** always download a copy.
- The diagram is still autosaved in browser localStorage, but localStorage is not a substitute for a file backup.
- When the editor is open, Save/Save As requests an XML export from the editor before writing. Test the embed event flow in your browser.

**Browser support:** Direct file write generally requires Chromium on localhost/secure context. Safari/Firefox use downloads instead. Saving to disk is never automatic; browser permission is required.
