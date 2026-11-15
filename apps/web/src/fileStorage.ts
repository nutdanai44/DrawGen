export interface LocalFileHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{write(data:string):Promise<void>;close():Promise<void>}>;
}
export function normalizeFileName(name:string):string {
  const base=(name.trim()||'Untitled').replace(/[\\/:*?"<>|]/g,'_');
  return /\.drawio$/i.test(base)?base:base.replace(/\.xml$/i,'')+'.drawio';
}
export function downloadDrawio(xml:string,name:string):void {
  const url=URL.createObjectURL(new Blob([xml],{type:'application/xml;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=normalizeFileName(name);link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function saveDrawioFile(xml:string,name:string,handle:LocalFileHandle|null):Promise<{handle:LocalFileHandle|null;name:string;downloaded:boolean}> {
  const filename=normalizeFileName(name);
  let target=handle;
  if(!target && 'showSaveFilePicker' in window){
    const picker=window as Window & {showSaveFilePicker:(options:object)=>Promise<LocalFileHandle>};
    target=await picker.showSaveFilePicker({suggestedName:filename,types:[{description:'draw.io diagram',accept:{'application/xml':['.drawio']}}]});
  }
  if(target){
    const writable=await target.createWritable();await writable.write(xml);await writable.close();
    return {handle:target,name:target.name,downloaded:false};
  }
  downloadDrawio(xml,filename);
  return {handle:null,name:filename,downloaded:true};
}
