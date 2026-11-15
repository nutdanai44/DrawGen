import { useCallback, useEffect, useRef, useState } from 'react';
import { DRAWIO_ORIGIN, DRAWIO_URL, EMPTY_XML, isDrawioXml, parseEditorMessage } from './editorBridge';

type Doc = { xml: string; revision: number; updatedAt: string };
type Mode = 'discuss' | 'auto' | 'review';
type Provider = 'openai' | 'anthropic';
const KEY = 'ai-flow-studio.phase1.document';
const initial: Doc = { xml: EMPTY_XML, revision: 0, updatedAt: new Date().toISOString() };
function restore(): Doc {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null') as Doc | null;
    if (value && isDrawioXml(value.xml) && Number.isInteger(value.revision)) return value;
  } catch { /* fallback */ }
  return initial;
}
export default function App() {
  const [doc, setDoc] = useState<Doc>(restore);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>('discuss');
  const [provider, setProvider] = useState<Provider>('openai');
  const [prompt, setPrompt] = useState('');
  const [notice, setNotice] = useState('Phase 1: draw.io is ready; AI chat comes in Phase 2.');
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef(doc);
  useEffect(() => {
    latest.current = doc;
    try { localStorage.setItem(KEY, JSON.stringify(doc)); }
    catch { setNotice('Browser storage unavailable. Export your work.'); }
  }, [doc]);
  const send = useCallback((value: object) => {
    frame.current?.contentWindow?.postMessage(JSON.stringify(value), DRAWIO_ORIGIN);
  }, []);
  const save = useCallback((xml: string) => {
    if (!isDrawioXml(xml)) { setNotice('Invalid XML: changes were not saved.'); return; }
    setDoc(prev => prev.xml === xml ? prev : ({ xml, revision: prev.revision + 1, updatedAt: new Date().toISOString() }));
    setNotice('Saved locally.');
  }, []);
  useEffect(() => {
    if (!open) return;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      const message = parseEditorMessage(event);
      if (!message) return;
      if (message.event === 'init') { setReady(true); send({ action: 'load', xml: latest.current.xml, autosave: 1 }); }
      if ((message.event === 'autosave' || message.event === 'save') && message.xml) save(message.xml);
      if (message.event === 'exit') { setOpen(false); setReady(false); }
      if (message.event === 'error') setNotice(message.message || 'Editor error');
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [open, send, save]);
  function exportFile() {
    const url = URL.createObjectURL(new Blob([doc.xml], { type: 'application/xml' }));
    const a = document.createElement('a'); a.href = url; a.download = 'flow-studio.drawio'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importFile(file?: File) {
    if (!file) return;
    if (open) { setNotice('Close editor before importing.'); return; }
    const xml = await file.text();
    if (!isDrawioXml(xml)) { setNotice('Invalid draw.io file'); return; }
    save(xml); setNotice('Imported ' + file.name);
  }
  function newFile() {
    if (open) { setNotice('Close editor first.'); return; }
    if (confirm('Replace current diagram? Export a backup if needed.')) save(EMPTY_XML);
  }
  return <div className="shell">
    <header className="topbar"><div className="brand">◇ AI Flow Studio <small>Phase 1</small></div><nav>
      <button onClick={newFile}>New</button>
      <label className="file-button">Import<input hidden type="file" accept=".drawio,.xml" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ''; }} /></label>
      <button onClick={exportFile}>Export .drawio</button>
      <button className="primary" onClick={() => setOpen(true)}>Open Editor</button>
    </nav></header>
    <main><aside className="chat"><h3>AI Assistant <small>Phase 2</small></h3><label>Provider</label><select value={provider} onChange={e => setProvider(e.target.value as Provider)}><option value="openai">OpenAI</option><option value="anthropic">Claude</option></select>
      <label>Hybrid Mode</label><div className="modes">{(['discuss','auto','review'] as const).map(m => <button key={m} className={mode === m ? 'selected' : ''} onClick={() => setMode(m)}>{m}</button>)}</div>
      <div className="chat-placeholder"><h2>Design flows together</h2><p>Discuss the design and approve AI changes in future phases.</p><p>“Create a login flow with OTP and token refresh”</p></div>
      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="AI chat available in Phase 2" /><button disabled>Send (Phase 2)</button>
    </aside><section className="workspace"><div className="heading"><strong>Diagram Workspace</strong><span>Revision {doc.revision} · {new Date(doc.updatedAt).toLocaleString()}</span></div>
      {open ? <div className="editor"><div className="editor-bar"><span>{ready ? 'Editor connected' : 'Connecting…'}</span><button onClick={() => send({ action: 'save' })}>Save</button><button onClick={() => { if (confirm('Close editor? Unsaved edits may be lost.')) { setOpen(false); setReady(false); } }}>Close</button></div>
        <iframe ref={frame} title="draw.io Editor" src={DRAWIO_URL} allow="clipboard-read; clipboard-write" /></div>
      : <div className="empty"><h2>Ready to draw</h2><p>Open draw.io to create and edit your diagram. Auto-save keeps your work in the browser.</p><button className="primary" onClick={() => setOpen(true)}>Open draw.io Editor</button></div>}
      <footer>{notice}</footer></section></main>
  </div>;
}
