import { cp, mkdir, rm } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const name of ['index.html', 'src', 'vendor', 'assets']) await cp(name, `dist/${name}`, { recursive: true });
for (const name of ['main.js','physics.worker.js','scene.js','style.css','volumetric-scene.js','field-shaders.js']) await rm(`dist/src/${name}`,{force:true});
console.log('Built static app in dist/');
