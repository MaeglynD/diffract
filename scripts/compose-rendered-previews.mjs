import {readFile,writeFile} from 'node:fs/promises';
import {EXPERIMENTS} from '../src/experiments.js';
for(const e of EXPERIMENTS){
 let scene;try{scene=await readFile(`assets/previews/rendered/${e.id}.png`);}catch{continue;}
 const previous=await readFile(`assets/previews/${e.id}.svg`,'utf8'),images=[...previous.matchAll(/<image href="(data:image\/png;base64,[^"]+)"/g)],detector=images.at(-1)?.[1];if(!detector)throw Error('Detector preview missing: '+e.id);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="194" viewBox="0 0 360 194"><image href="data:image/png;base64,${scene.toString('base64')}" x="-8" y="15" width="252" height="164" preserveAspectRatio="xMidYMid meet"/><image href="${detector}" x="244" y="39" width="112" height="116"/><path d="M244 39h112v116H244" fill="none" stroke="#88bbc7" stroke-opacity=".18"/></svg>`;
 await writeFile(`assets/previews/${e.id}.svg`,svg);
}
