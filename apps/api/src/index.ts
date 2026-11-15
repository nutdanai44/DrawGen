import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
const app = Fastify({ logger: true, bodyLimit: 6_000_000 });
await app.register(cors, { origin: ["http://localhost:5173", "http://127.0.0.1:5173"] });
type Provider = 'openai' | 'anthropic';
type Mode = 'discuss' | 'auto' | 'review';
type ChatMessage = { role: 'user' | 'assistant'; content: string };
type ChatBody = { provider: Provider; mode: Mode; prompt: string; xml: string; history?: ChatMessage[]; apiKey?: string };
const SYSTEM = `You are a precise diagrams.net/draw.io flowchart designer. Respond with ONLY a JSON object: {"message":"brief explanation","xml":null or "<mxfile ...>...</mxfile>","changes":["short summary of each change"]}. For DISCUSS mode, xml MUST be null and you must discuss the design, ask only necessary questions, and never change the diagram. For AUTO or REVIEW modes, return a COMPLETE valid uncompressed mxfile XML document with a diagram containing mxGraphModel/root/mxCell id=0 and id=1. Preserve existing nodes, edges, stable IDs, positions and styles when modifying a nonempty diagram unless specifically asked to change them. Each vertex needs vertex="1", parent="1", mxGeometry x,y,width,height as="geometry"; each edge needs edge="1", parent="1", source and target IDs, mxGeometry relative="1" as="geometry". Avoid collisions by using 180px horizontal and 100px vertical spacing. Use ellipse for start/end, rhombus for decisions, rounded rectangles for processes, orthogonal edgeStyle for connectors, label Yes/No decision edges. Escape XML attribute values correctly. Never include markdown fences. Do not include secrets in XML or message. If user request is ambiguous, discuss instead of generating, with xml null.`;
function parseResponse(raw: string): { message: string; xml: string | null; changes: string[] } {
  const cleaned = raw.trim().replace(/^\x60\x60\x60(?:json)?\s*/i, '').replace(/\s*\x60\x60\x60$/, '');
  let result: unknown;
  try { result = JSON.parse(cleaned); } catch { throw new Error('AI returned invalid JSON. Please retry.'); }
  if (!result || typeof result !== 'object') throw new Error('Invalid AI response');
  const obj = result as Record<string, unknown>;
  if (typeof obj.message !== 'string' || (obj.xml !== null && typeof obj.xml !== 'string' && obj.xml !== undefined)) throw new Error('Invalid AI response schema');
  const xml = typeof obj.xml === 'string' ? obj.xml : null;
  if (xml && (!xml.trim().startsWith('<mxfile') || !xml.includes('<mxGraphModel') || !xml.includes('<root'))) throw new Error('AI returned invalid draw.io XML');
  return { message: obj.message, xml, changes: Array.isArray(obj.changes) ? obj.changes.filter((x): x is string => typeof x === 'string') : [] };
}
async function askOpenAI(key: string, messages: Array<{role:string;content:string}>) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', { method:'POST', headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'}, body:JSON.stringify({model:process.env.OPENAI_MODEL || 'gpt-4.1-mini',messages,temperature:0.2}) });
  const json = await response.json() as any;
  if (!response.ok) throw new Error('OpenAI API ('+response.status+'): '+(json.error?.message || 'Request failed'));
  return json.choices?.[0]?.message?.content as string | undefined;
}
async function askClaude(key: string, messages: Array<{role:string;content:string}>) {
  const response = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', headers:{'x-api-key':key,'anthropic-version':'2023-06-01','Content-Type':'application/json'}, body:JSON.stringify({model:process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',max_tokens:8192,system:SYSTEM,messages:messages.filter(m=>m.role!=='system')}) });
  const json = await response.json() as any;
  if (!response.ok) throw new Error('Claude API ('+response.status+'): '+(json.error?.message || 'Request failed'));
  return json.content?.filter((c:any)=>c.type==='text').map((c:any)=>c.text).join('') as string | undefined;
}
app.get('/health', async () => ({ status: 'ok', phase: 2 }));
app.get('/api/providers', async () => ({ providers: ['openai','anthropic'] }));
app.post<{Body:ChatBody}>('/api/chat', async (request, reply) => {
  const body = request.body;
  if (!body || !['openai','anthropic'].includes(body.provider) || !['discuss','auto','review'].includes(body.mode) || typeof body.prompt!=='string' || !body.prompt.trim() || body.prompt.length>10000 || typeof body.xml!=='string' || body.xml.length>4_000_000) return reply.code(400).send({error:'Invalid request'});
  const key = body.apiKey?.trim() || (body.provider==='openai'?process.env.OPENAI_API_KEY:process.env.ANTHROPIC_API_KEY);
  if (!key) return reply.code(400).send({error:'Enter an API key for the selected provider.'});
  const history = Array.isArray(body.history) ? body.history.slice(-12).filter(m=>m && (m.role==='user'||m.role==='assistant') && typeof m.content==='string').map(m=>({role:m.role,content:m.content.slice(0,4000)})) : [];
  const userText = 'MODE: '+body.mode.toUpperCase()+'\nCURRENT DIAGRAM XML:\n'+body.xml+'\nUSER REQUEST:\n'+body.prompt;
  const messages = [{role:'system',content:SYSTEM},...history,{role:'user',content:userText}];
  try {
    const raw = body.provider==='openai' ? await askOpenAI(key,messages) : await askClaude(key,messages);
    if (!raw) throw new Error('AI returned an empty response');
    const result = parseResponse(raw);
    if (body.mode==='discuss') result.xml=null;
    return result;
  } catch (error) {
    request.log.warn({reason:error instanceof Error?error.message:'AI failure'}, 'AI request failed');
    return reply.code(502).send({error:error instanceof Error?error.message:'AI request failed'});
  }
});
await app.listen({ port: Number(process.env.API_PORT ?? 3001), host: '127.0.0.1' });
