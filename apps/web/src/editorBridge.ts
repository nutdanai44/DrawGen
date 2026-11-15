export const DRAWIO_ORIGIN = "https://embed.diagrams.net";
export const DRAWIO_ORIGINS = ["https://embed.diagrams.net", "https://app.diagrams.net"] as const;
export const DRAWIO_URL = `${DRAWIO_ORIGIN}/?embed=1&proto=json&spin=1&ui=min&saveAndExit=0`;
export const EMPTY_XML = `<mxfile host="app.diagrams.net"><diagram id="page-1" name="Page-1"><mxGraphModel dx="1000" dy="700" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100"><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`;
export interface EditorMessage { event: string; xml?: string; message?: string }
export function parseEditorMessage(event: MessageEvent): EditorMessage | null { if(!DRAWIO_ORIGINS.includes(event.origin as typeof DRAWIO_ORIGINS[number])) return null; try {const data=typeof event.data==="string"?JSON.parse(event.data):event.data;return data&&typeof data.event==="string"?data:null;}catch{return null;} }
export function isDrawioXml(xml:string):boolean {try{const doc=new DOMParser().parseFromString(xml,"application/xml");return !doc.querySelector("parsererror")&&["mxfile","mxGraphModel"].includes(doc.documentElement.tagName);}catch{return false;}}

export function countDiagramCells(xml:string):number {
  try {
    const parsed=new DOMParser().parseFromString(xml,'application/xml');
    if(parsed.querySelector('parsererror'))return 0;
    return [...parsed.querySelectorAll('mxCell')].filter(cell=>cell.getAttribute('vertex')==='1'||cell.getAttribute('edge')==='1').length;
  }catch{return 0;}
}

/** draw.io embed expects uncompressed mxGraphModel for the load action.
 * Desktop .drawio files typically wrap it in mxfile/diagram. */
export function xmlForEmbedLoad(xml:string):string {
  const parsed=new DOMParser().parseFromString(xml,'application/xml');
  if(parsed.querySelector('parsererror'))throw new Error('Invalid XML');
  if(parsed.documentElement.tagName==='mxGraphModel')return xml;
  const diagram=parsed.querySelector('mxfile > diagram');
  if(!diagram)throw new Error('No diagram page found');
  const model=diagram.querySelector('mxGraphModel');
  if(model)return new XMLSerializer().serializeToString(model);
  // Compressed draw.io pages contain base64+deflate; preserve the full mxfile
  // so the editor can decode it instead of accidentally loading an empty graph.
  return xml;
}
