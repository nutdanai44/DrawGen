import { compareDiagrams } from './diagramDiff';
import { useCallback, useEffect, useRef, useState } from 'react';
import { downloadDrawio, saveDrawioFile, normalizeFileName, type LocalFileHandle } from './fileStorage';
import { DRAWIO_ORIGIN, DRAWIO_URL, EMPTY_XML, xmlForEmbedLoad, isDrawioXml, countDiagramCells, parseEditorMessage } from './editorBridge';
type Doc = { xml: string; revision: number; updatedAt: string };
type Mode = 'discuss' | 'auto' | 'review';
type Provider = 'openai' | 'anthropic';
type ChatLine = { role: 'user' | 'assistant'; content: string };
type Proposal = { xml: string; changes: string[]; baseRevision: number };
const KEY = 'ai-flow-studio.phase1.document';
const initial: Doc = { xml: EMPTY_XML, revision: 0, updatedAt: new Date().toISOString() };
function restore(): Doc { try { const value = JSON.parse(localStorage.getItem(KEY) || 'null') as Doc | null; if (value && isDrawioXml(value.xml) && Number.isInteger(value.revision)) return value; } catch {} return initial; }
export default function App() {
  const [doc,setDoc] = useState<Doc>(restore);
  const [undoStack,setUndoStack] = useState<string[]>([]);
  const [redoStack,setRedoStack] = useState<string[]>([]);
  const [fileName,setFileName] = useState('Untitled.drawio');
  const [fileHandle,setFileHandle] = useState<LocalFileHandle|null>(null);
  const [savedRevision,setSavedRevision] = useState<number|null>(null);
  const [open,setOpen] = useState(false);
  const [ready,setReady] = useState(false);
  const [editorGeneration,setEditorGeneration] = useState(0);
  const [mode,setMode] = useState<Mode>('discuss');
  const [provider,setProvider] = useState<Provider>('openai');
  const [keys,setKeys] = useState<Record<Provider,string>>({openai:'',anthropic:''});
  const [showKey,setShowKey] = useState(false);
  const [prompt,setPrompt] = useState('');
  const [lines,setLines] = useState<ChatLine[]>([]);
  const [proposal,setProposal] = useState<Proposal|null>(null);
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState('Phase 2 ready: choose provider, enter API key, and start chatting.');
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef(doc);
  const linesRef = useRef(lines);
  const pending = useRef(false);
  const fileAction = useRef<'save'|'saveAs'|null>(null);
  const exportTimeout = useRef<ReturnType<typeof setTimeout>|null>(null);
  const initTimeout = useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{latest.current=doc;try{localStorage.setItem(KEY,JSON.stringify(doc));}catch{setNotice('Browser storage unavailable. Export your work.');}},[doc]);
  useEffect(()=>{linesRef.current=lines;},[lines]);
  const send = useCallback((value:object)=>{frame.current?.contentWindow?.postMessage(JSON.stringify(value),DRAWIO_ORIGIN);},[]);
  const save = useCallback((xml:string)=>{
    if(!isDrawioXml(xml)){setNotice('Invalid XML: changes were not saved.');return;}
    setDoc(prev=>prev.xml===xml?prev:{xml,revision:prev.revision+1,updatedAt:new Date().toISOString()});
  },[]);
  useEffect(()=>{
    if(!open)return;
    initTimeout.current=setTimeout(()=>setNotice('draw.io did not initialize. Check network access to embed.diagrams.net and browser console.'),15000);
    const onMessage=(event:MessageEvent)=>{
      if(event.source!==frame.current?.contentWindow)return;
      const message=parseEditorMessage(event);if(!message)return;
      if(message.event==='init'){
        if(initTimeout.current)clearTimeout(initTimeout.current);
        try {send({action:'load',xml:xmlForEmbedLoad(latest.current.xml),autosave:1});setReady(true);setNotice('Editor loaded: '+countDiagramCells(latest.current.xml)+' diagram elements.');}
        catch(error){setNotice('Could not load diagram: '+(error as Error).message);}
      }
      if((message.event==='autosave'||message.event==='save')&&message.xml){if(!pending.current){if(countDiagramCells(message.xml)===0&&countDiagramCells(latest.current.xml)>0)setNotice('Empty editor autosave ignored to prevent losing the diagram.');else save(message.xml);}}
      if(message.event==='export' && typeof message.xml==='string') {
        if(exportTimeout.current)clearTimeout(exportTimeout.current);
        const action=fileAction.current;fileAction.current=null;
        if(!isDrawioXml(message.xml)){setNotice('Editor export was invalid. File not saved.');return;}
        if(countDiagramCells(message.xml)===0 && countDiagramCells(latest.current.xml)>0){setNotice('Editor returned an empty diagram. File save blocked to prevent data loss.');return;}
        save(message.xml);latest.current={...latest.current,xml:message.xml,revision:latest.current.revision+(message.xml===latest.current.xml?0:1)};
        if(action)void persistFile(action,message.xml);
      }
      if(message.event==='load')setNotice('draw.io confirmed diagram load.');
      if(message.event==='exit'){setOpen(false);setReady(false);}
      if(message.event==='error')setNotice(message.message||'Editor error');
    };
    window.addEventListener('message',onMessage);return()=>{window.removeEventListener('message',onMessage);if(initTimeout.current)clearTimeout(initTimeout.current);};
  },[open,send,save,editorGeneration]);
  function setDiagramSnapshot(xml:string){
    if(!isDrawioXml(xml))return;
    const previous=latest.current.xml;
    if(previous===xml)return;
    setUndoStack(items=>[...items.slice(-19),previous]);setRedoStack([]);
    applyXml(xml);
  }
  function undoDiagram(){
    if(!undoStack.length)return;
    const previous=undoStack[undoStack.length-1];
    setUndoStack(items=>items.slice(0,-1));setRedoStack(items=>[...items,latest.current.xml]);applyXml(previous);setProposal(null);
  }
  function redoDiagram(){
    if(!redoStack.length)return;
    const next=redoStack[redoStack.length-1];
    setRedoStack(items=>items.slice(0,-1));setUndoStack(items=>[...items,latest.current.xml]);applyXml(next);setProposal(null);
  }
  function applyXml(xml:string){
    if(!isDrawioXml(xml)){setNotice('AI XML validation failed. No changes applied.');return;}
    pending.current=true;
    save(xml);latest.current={xml,revision:latest.current.revision+1,updatedAt:new Date().toISOString()};
    if(open){setReady(false);setEditorGeneration(v=>v+1);}
    setTimeout(()=>{pending.current=false;},1500);
    setNotice('AI changes applied. Revision saved locally.');
  }
  function applyProposal(){if(!proposal)return;if(proposal.baseRevision!==latest.current.revision){setNotice('Diagram changed since proposal. Please regenerate.');setProposal(null);return;}setDiagramSnapshot(proposal.xml);setProposal(null);}
  async function submit(){
    const input=prompt.trim();if(!input||busy)return;
    const revision=latest.current.revision;
    const history=linesRef.current.slice(-12);
    setLines(prev=>[...prev,{role:'user',content:input}]);setPrompt('');setBusy(true);setNotice('Contacting '+provider+'...');
    try{
      const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider,mode,prompt:input,xml:latest.current.xml,history,apiKey:keys[provider]})});
      const data=await response.json() as {error?:string;message?:string;xml?:string|null;changes?:string[]};
      if(!response.ok)throw new Error(data.error||'AI request failed');
      setLines(prev=>[...prev,{role:'assistant',content:data.message||'Done.'}]);
      if(data.xml){
        if(!isDrawioXml(data.xml))throw new Error('AI returned invalid XML');
        if(latest.current.revision!==revision){setProposal({xml:data.xml,changes:data.changes||[],baseRevision:revision});setNotice('Diagram changed during AI response. Review required.');}
        else if(mode==='review'){setProposal({xml:data.xml,changes:data.changes||[],baseRevision:revision});setNotice('Review changes before applying.');}
        else if(mode==='auto')setDiagramSnapshot(data.xml);
      }else setNotice('Discussion updated; diagram unchanged.');
    }catch(error){const msg=error instanceof Error?error.message:'Unknown error';setLines(prev=>[...prev,{role:'assistant',content:'Error: '+msg}]);setNotice(msg);}
    finally{setBusy(false);}
  }
  async function persistFile(action:'save'|'saveAs', xml:string=latest.current.xml) {
    if(!isDrawioXml(xml)){setNotice('Cannot save invalid draw.io XML');return;}
    if(countDiagramCells(xml)===0 && !confirm('This diagram has no shapes. Save an empty file?'))return;
    try {
      const result=await saveDrawioFile(xml,fileName,action==='save'?fileHandle:null);
      if(result.handle)setFileHandle(result.handle);
      setFileName(result.name);
      setSavedRevision(latest.current.revision);
      setNotice(result.downloaded?'Downloaded '+result.name+' (browser does not support direct file save).':'Saved '+result.name+' to your selected location.');
    } catch(error) {
      if((error as Error).name!=='AbortError')setNotice('Save failed: '+(error as Error).message);
    }
  }
  function requestSave(action:'save'|'saveAs') {
    if(open && ready) {
      fileAction.current=action;
      if(exportTimeout.current)clearTimeout(exportTimeout.current);
      exportTimeout.current=setTimeout(()=>{if(fileAction.current){fileAction.current=null;setNotice('Editor did not return XML. Save cancelled; try again.');}},12000);
      send({action:'export',format:'xml',xml:1});
      setNotice('Syncing editor before saving…');
    } else if(open) setNotice('Wait for editor to connect before saving.');
    else void persistFile(action);
  }
  function openImportedDiagram(xml:string,name:string,handle:LocalFileHandle|null){
    if(!isDrawioXml(xml)){setNotice('Invalid draw.io file');return;}
    const count=countDiagramCells(xml);
    const next={xml,revision:latest.current.revision+1,updatedAt:new Date().toISOString()};
    latest.current=next;setDoc(next);setFileName(normalizeFileName(name));setFileHandle(handle);setSavedRevision(handle?next.revision:null);setProposal(null);
    setUndoStack([]);setRedoStack([]);
    setReady(false);setEditorGeneration(v=>v+1);setOpen(true);
    setNotice('Opening '+name+' ('+count+' shapes/connections) in draw.io…');
  }
  async function importFile(file?:File){
    if(!file)return;
    if(open){setNotice('Close editor before opening another file.');return;}
    const xml=await file.text();
    if(!isDrawioXml(xml)){setNotice('Invalid draw.io file');return;}
    openImportedDiagram(xml,file.name,null);
  }
  async function openFile(){
    if(open){setNotice('Close editor before opening another file.');return;}
    if('showOpenFilePicker' in window) {
      try {
        const picker=window as Window & {showOpenFilePicker:(options:object)=>Promise<LocalFileHandle[]>};
        const handles=await picker.showOpenFilePicker({multiple:false,types:[{description:'draw.io diagrams',accept:{'application/xml':['.drawio','.xml']}}]});
        const handle=handles[0];if(!handle)return;
        const file=await handle.getFile();const xml=await file.text();
        if(!isDrawioXml(xml)){setNotice('Invalid draw.io file');return;}
        openImportedDiagram(xml,file.name,handle);
      }catch(error){if((error as Error).name!=='AbortError')setNotice('Open failed: '+(error as Error).message);}
    } else document.getElementById('diagram-file-input')?.click();
  }
  function newFile(){
    if(open){setNotice('Close editor first.');return;}
    if(confirm('Replace current diagram? Save a backup if needed.')){
      save(EMPTY_XML);latest.current={...latest.current,xml:EMPTY_XML,revision:latest.current.revision+1};
      setUndoStack([]);setRedoStack([]);setFileName('Untitled.drawio');setFileHandle(null);setSavedRevision(null);setProposal(null);setLines([]);
    }
  }
  return <div className="shell">
    <header className="topbar"><div className="brand">◇ AI Flow Studio <small>Phase 2</small></div><nav><button onClick={newFile}>New</button><button disabled={!undoStack.length} onClick={undoDiagram} title="Undo last AI change">Undo AI</button><button disabled={!redoStack.length} onClick={redoDiagram} title="Redo last AI change">Redo AI</button><button onClick={()=>void openFile()}>Open File</button><input id="diagram-file-input" hidden type="file" accept=".drawio,.xml" onChange={e=>{void importFile(e.target.files?.[0]);e.target.value='';}}/><button onClick={()=>requestSave('save')}>Save</button><button onClick={()=>requestSave('saveAs')}>Save As</button><button onClick={()=>downloadDrawio(doc.xml,fileName)}>Download</button><button className="primary" onClick={()=>setOpen(true)}>Open Editor</button></nav></header>
    <main><aside className="chat"><h3>AI Assistant <small>OpenAI + Claude</small></h3>
      <label>AI Provider</label><select value={provider} onChange={e=>setProvider(e.target.value as Provider)}><option value="openai">OpenAI</option><option value="anthropic">Claude (Anthropic)</option></select>
      <label>{provider==='openai'?'OpenAI API Key':'Anthropic API Key'} (session only)</label>
      <div className="key-row"><input type={showKey?'text':'password'} value={keys[provider]} placeholder={provider==='openai'?'sk-...':'sk-ant-...'} autoComplete="off" onChange={e=>setKeys(prev=>({...prev,[provider]:e.target.value}))}/><button onClick={()=>setShowKey(v=>!v)}>{showKey?'Hide':'Show'}</button></div>
      <p className="hint">Key stays in page memory, not browser storage. Backend also accepts keys from local .env. API usage is billed separately.</p>
      <label>Hybrid Mode</label><div className="modes">{(['discuss','auto','review'] as const).map(m=><button key={m} className={mode===m?'selected':''} onClick={()=>setMode(m)}>{m}</button>)}</div>
      <div className="chat-history">{lines.length===0?<div className="chat-placeholder"><h2>Design flows together</h2><p>Discuss first, then choose Auto or Review to create/edit the diagram.</p><p>Try “Create a login flow with OTP and token refresh”</p></div>:lines.map((m,i)=><div className={'bubble '+m.role} key={i}><strong>{m.role==='user'?'You':provider==='openai'?'AI':'AI'}</strong><p>{m.content}</p></div>)}</div>
      {proposal&&<div className="proposal"><strong>Proposed changes (revision {proposal.baseRevision})</strong><div className="diff-summary">{(()=>{const d=compareDiagrams(doc.xml,proposal.xml);return <><p>+ {d.added.length} added · ~ {d.modified.length} modified · − {d.removed.length} removed</p>{d.warning&&<p>{d.warning}</p>}{d.added.length>0&&<p>Added IDs: {d.added.slice(0,12).join(', ')}</p>}{d.modified.length>0&&<p>Modified IDs: {d.modified.slice(0,12).join(', ')}</p>}{d.removed.length>0&&<p>Removed IDs: {d.removed.slice(0,12).join(', ')}</p>}</>;})()}</div>{proposal.changes.map((c,i)=><p key={i}>• {c}</p>)}<div className="proposal-buttons"><button className="primary" onClick={applyProposal}>Apply</button><button onClick={()=>{setProposal(null);setNotice('Proposal rejected.');}}>Reject</button></div></div>}
      <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void submit();}}} placeholder="Describe a flow or request a change..."/><button className="primary" disabled={busy||!prompt.trim()} onClick={()=>void submit()}>{busy?'Generating…':mode==='discuss'?'Discuss':mode==='review'?'Propose Changes':'Generate / Apply'}</button>
    </aside><section className="workspace"><div className="heading"><strong><input aria-label="Diagram filename" className="filename-input" value={fileName} onChange={e=>setFileName(e.target.value)} onBlur={()=>setFileName(v=>normalizeFileName(v))}/>{savedRevision!==doc.revision?' • Unsaved to file':''}</strong><span>Revision {doc.revision} · {new Date(doc.updatedAt).toLocaleString()}</span></div>
      {open?<div className="editor"><div className="editor-bar"><span>{ready?'Editor connected':'Connecting…'}</span><button onClick={()=>send({action:'save'})}>Save</button><button onClick={()=>{if(confirm('Close editor? Unsaved edits may be lost.')){setOpen(false);setReady(false);}}}>Close</button></div><iframe key={editorGeneration} ref={frame} title="draw.io Editor" src={DRAWIO_URL} allow="clipboard-read; clipboard-write"/></div>
      :<div className="empty"><h2>Ready to draw</h2><p>Open draw.io to create or edit, or ask AI to generate a diagram.</p><button className="primary" onClick={()=>setOpen(true)}>Open draw.io Editor</button></div>}
      <footer>{notice}</footer></section></main>
  </div>;
}
