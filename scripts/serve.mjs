import http from 'node:http';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)), process.argv.includes('--dist') ? 'dist' : '.');
const port = Number(process.env.PORT || 5173);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain', '.woff2': 'font/woff2' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const path = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const entry=await stat(path),file=entry.isDirectory()?resolve(path,'index.html'):path,info=entry.isDirectory()?await stat(file):entry;
    const etag=`W/"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`,type=types[extname(file)]||'application/octet-stream';
    const headers={'Content-Type':type+(type.startsWith('text/')||type==='application/json'?'; charset=utf-8':''),'Cache-Control':'no-cache','ETag':etag,'X-Content-Type-Options':'nosniff'};
    if(req.headers['if-none-match']===etag){res.writeHead(304,headers).end();return;}
    res.writeHead(200,{...headers,'Content-Length':info.size});
    if(req.method==='HEAD'){res.end();return;}
    // Field assets can exceed 100 MiB. Stream them with backpressure rather
    // than retaining a second complete copy for every in-flight request.
    const stream=createReadStream(file);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Optics · http://127.0.0.1:${port}`));
