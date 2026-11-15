export type DiagramDiff = {added:string[];removed:string[];modified:string[];warning?:string};
function cells(xml:string):Map<string,string>{
  const parsed=new DOMParser().parseFromString(xml,'application/xml');
  if(parsed.querySelector('parsererror'))throw new Error('Invalid XML');
  const out=new Map<string,string>();
  for(const cell of Array.from(parsed.querySelectorAll('mxCell'))){
    const id=cell.getAttribute('id');
    if(!id || (cell.getAttribute('vertex')!=='1' && cell.getAttribute('edge')!=='1'))continue;
    out.set(id,new XMLSerializer().serializeToString(cell));
  }
  return out;
}
export function compareDiagrams(before:string,after:string):DiagramDiff{
  try {
    const old=cells(before),next=cells(after);
    return {
      added:[...next.keys()].filter(k=>!old.has(k)),
      removed:[...old.keys()].filter(k=>!next.has(k)),
      modified:[...next.keys()].filter(k=>old.has(k)&&old.get(k)!==next.get(k))
    };
  }catch(error){return {added:[],removed:[],modified:[],warning:(error as Error).message};}
}
