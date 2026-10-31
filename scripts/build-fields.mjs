// Run only when publishing new reference fields. A normal website build reads
// the release index and never runs this script.
import {createHash} from 'node:crypto';
import {mkdir,readFile,readdir,writeFile,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {packageFields} from './package-fields.mjs';
import {libraryRoot,fieldOrigin,validate,readRelease,digest} from './field-library.mjs';

const output=new URL('dist/',libraryRoot), releases=new URL('releases/',libraryRoot);
const manifest=await packageFields(fileURLToPath(new URL('../assets/fields/',libraryRoot)),fileURLToPath(output));
validate(manifest);
const body=Buffer.from(JSON.stringify(manifest)+'\n'),current=digest(body);
await mkdir(releases,{recursive:true});
await mkdir(new URL('releases/',output),{recursive:true});
const ids=new Set((await readdir(releases)).filter(f=>/^[0-9a-f]{64}\.json$/.test(f)).map(f=>f.slice(0,-5)));
ids.add(current);
if(!process.argv.includes('--bootstrap')){
  const response=await fetch(fieldOrigin+'catalog.json',{cache:'no-store',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Cannot check previously published releases: HTTP '+response.status);
  for(const id of (await response.json()).releases){
    if(!ids.has(id))throw Error('This checkout is missing published release '+id+'. Update the checkout before publishing.');
  }
}
// Retain previous releases for open tabs and for rollbacks. On a fresh
// maintainer checkout, recover superseded chunks from the public field host.
const checked=new Set();
for(const id of ids){
  const index=id===current?manifest:await readRelease(id);
  validate(index,false);
  for(const entry of Object.values(index)){
    if(checked.has(entry.sha256))continue;
    const hash=createHash('sha256');
    for(const part of entry.parts){
      const name='chunks/'+part.file,path=new URL(name,output);
      let bytes;
      try{bytes=await readFile(path);}catch(error){
        if(error.code!=='ENOENT')throw error;
        const response=await fetch(fieldOrigin+name,{signal:AbortSignal.timeout(120000)});
        if(!response.ok)throw Error('Cannot recover retained chunk '+part.file+': HTTP '+response.status);
        bytes=Buffer.from(await response.arrayBuffer());
        if(digest(bytes)+'.part'!==part.file)throw Error('Invalid downloaded chunk '+part.file);
        await writeFile(path,bytes);
      }
      if(bytes.length!==part.bytes||digest(bytes)+'.part'!==part.file)throw Error('Invalid field chunk '+part.file);
      hash.update(bytes);
    }
    if(hash.digest('hex')!==entry.sha256)throw Error('Invalid reconstructed field '+entry.sha256);
    checked.add(entry.sha256);
  }
  await writeFile(new URL('releases/'+id+'.json',output),id===current?body:await readFile(new URL(id+'.json',releases)));
}
await copyFile(new URL('_headers',libraryRoot),new URL('_headers',output));
await writeFile(new URL('catalog.json',output),JSON.stringify({releases:[...ids].sort()})+'\n');
await writeFile(new URL(current+'.json',releases),body);
await writeFile(new URL('current',libraryRoot),current+'\n');
console.log('Verified '+checked.size+' field volumes. Prepared '+fieldOrigin+'releases/'+current+'.json');
