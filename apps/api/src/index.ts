import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
const app = Fastify({ logger: true });
await app.register(cors, { origin: ["http://localhost:5173", "http://127.0.0.1:5173"] });
app.get("/health", async () => ({ status: "ok", phase: 1 }));
app.get("/api/providers", async () => ({ providers: [
  { id: "openai", configured: Boolean(process.env.OPENAI_API_KEY), enabled: false },
  { id: "anthropic", configured: Boolean(process.env.ANTHROPIC_API_KEY), enabled: false }
], note: "AI integrations arrive in Phase 2." }));
await app.listen({ port: Number(process.env.API_PORT ?? 3001), host: "127.0.0.1" });
