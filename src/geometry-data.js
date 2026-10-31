// Fetch, decompress and calculate vertex normals away from the interaction thread.
let worker,sequence=0;const jobs=new Map();
export function loadGeometry(path,kind,signal){
 signal?.throwIfAborted();
 if(!worker){worker=new Worker(new URL('./geometry-loader.worker.js',import.meta.url),{type:'module'});worker.onmessage=({data})=>{const job=jobs.get(data.id);if(!job)return;jobs.delete(data.id);job.cleanup();data.error?job.reject(Error(data.error)):job.resolve(data);};worker.onerror=event=>{for(const job of jobs.values()){job.cleanup();job.reject(Error(event.message));}jobs.clear();worker.terminate();worker=null;};}
 const id=++sequence;return new Promise((resolve,reject)=>{const abort=()=>{worker?.postMessage({id,abort:true});jobs.delete(id);reject(new DOMException('Aborted','AbortError'));};signal?.addEventListener('abort',abort,{once:true});jobs.set(id,{resolve,reject,cleanup:()=>signal?.removeEventListener('abort',abort)});worker.postMessage({id,path,kind});});
}
