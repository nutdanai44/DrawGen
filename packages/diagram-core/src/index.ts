export type ApplyMode = 'discuss' | 'auto' | 'review';
export type DiagramDocument = { id: string; name: string; xml: string; revision: number; updatedAt: string };
export type DiagramOperation =
  | { type: 'addNode'; id: string; label: string; nodeType: 'process' | 'decision' | 'start' | 'end' }
  | { type: 'updateNode'; id: string; label?: string }
  | { type: 'deleteNode'; id: string }
  | { type: 'addEdge'; id: string; source: string; target: string; label?: string }
  | { type: 'deleteEdge'; id: string };
export type ChangeSet = { baseRevision: number; summary: string; operations: DiagramOperation[] };
export function isDrawioXml(xml: string): boolean {
  const value = xml.trim();
  return value.startsWith('<mxfile') || value.startsWith('<mxGraphModel');
}
export function createDocument(xml: string, name = 'Untitled diagram'): DiagramDocument {
  if (!isDrawioXml(xml)) throw new Error('Not a draw.io XML document');
  return { id: crypto.randomUUID(), name, xml, revision: 1, updatedAt: new Date().toISOString() };
}
export function updateDocument(document: DiagramDocument, xml: string): DiagramDocument {
  if (!isDrawioXml(xml)) throw new Error('Not a draw.io XML document');
  if (document.xml === xml) return document;
  return { ...document, xml, revision: document.revision + 1, updatedAt: new Date().toISOString() };
}
