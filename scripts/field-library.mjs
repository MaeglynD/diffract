import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {EXPERIMENTS} from '../src/experiments.js';

export const libraryRoot=new URL('../field-library/',import.meta.url);
export const fieldOrigin='https://fields.diffract.org/';
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const hex=/^[0-9a-f]{64}$/;
export function validate(manifest,checkCatalogue=true){
  if(checkCatalogue){
    const ids=[...EXPERIMENTS.filter(e=>!e.analytic).map(e=>e.id),'double-right'];
    const expected=ids.flatMap(id=>[id+'.bin.gz',id+'.preview.bin.gz']).sort();
    if(JSON.stringify(expected)!==JSON.stringify(Object.keys(manifest).sort()))throw Error('Field release does not match the experiment catalogue.');
  }
  for(const [name,entry] of Object.entries(manifest)){
    if(!/^[a-z0-9-]+(?:\.preview)?\.bin\.gz$/.test(name)||!hex.test(entry.sha256)||!entry.parts?.length)throw Error('Invalid field entry: '+name);
    let total=0;
    for(const part of entry.parts){
      if(!/^[0-9a-f]{64}\.part$/.test(part.file)||!Number.isSafeInteger(part.bytes)||part.bytes<1||part.bytes>25*1024**2)throw Error('Invalid field chunk: '+name);
      total+=part.bytes;
    }
    if(total!==entry.bytes)throw Error('Wrong total field size: '+name);
  }
}
export async function readRelease(id){
  if(!hex.test(id))throw Error('Invalid field release ID');
  const bytes=await readFile(new URL('releases/'+id+'.json',libraryRoot));
  if(digest(bytes)!==id)throw Error('Field release checksum mismatch: '+id);
  return JSON.parse(bytes);
}
export async function currentRelease(){
  const id=(await readFile(new URL('current',libraryRoot),'utf8')).trim();
  const fields=await readRelease(id);
  validate(fields);
  return {id,fields};
}
export function fieldModule(fields){
  return 'export const fieldBase = '+JSON.stringify(fieldOrigin)+';\nexport const fieldAssets = '+JSON.stringify(fields)+';\n';
}
