export const DRAWIO_ORIGIN = "https://embed.diagrams.net";
export const DRAWIO_URL = `${DRAWIO_ORIGIN}/?embed=1&proto=json&spin=1&ui=min&saveAndExit=0`;
export const EMPTY_XML = `<mxfile host="app.diagrams.net"><diagram id="page-1" name="Page-1"><mxGraphModel dx="1000" dy="700" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100"><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`;
export interface EditorMessage { event: string; xml?: string; message?: string }
export function parseEditorMessage(event: MessageEvent): EditorMessage | null { if(event.origin!==DRAWIO_ORIGIN) return null; try {const data=typeof event.data==="string"?JSON.parse(event.data):event.data;return data&&typeof data.event==="string"?data:null;}catch{return null;} }
export function isDrawioXml(xml:string):boolean {try{const doc=new DOMParser().parseFromString(xml,"application/xml");return !doc.querySelector("parsererror")&&["mxfile","mxGraphModel"].includes(doc.documentElement.tagName);}catch{return false;}}
