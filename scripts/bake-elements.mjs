import {writeFile,mkdir} from 'node:fs/promises';
import {EXPERIMENTS} from '../src/experiments.js';
import {buildRelief} from '../src/element-relief.js';
await mkdir('assets/elements',{recursive:true});
for(const e of EXPERIMENTS.filter(e=>e.kind==='phase'&&(!process.argv.slice(2).length||process.argv.slice(2).includes(e.id)))){
 const {positions,amplitudes,indices}=buildRelief(e),header=Buffer.alloc(1024);
 header.write(JSON.stringify({vertices:amplitudes.length,indices:indices.length}));
 await writeFile(`assets/elements/${e.id}.relief`,Buffer.concat([header,Buffer.from(positions.buffer),Buffer.from(amplitudes.buffer),Buffer.from(indices.buffer)]));
 console.log(e.id+': phase relief baked');
}
