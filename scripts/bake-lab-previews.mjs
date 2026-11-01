import {writeFile} from 'node:fs/promises';
import {acousticModel,drumModel,DRUM,drumHeight} from '../src/resonant-instruments.js';
import {prepareSpectralBench,benchPlane} from '../src/spectral-bench.js';
import {color,png} from './preview-raster.mjs';
import {SCATTER,LENSLETS} from '../src/wavefront-benches.js';
import {CONVEYOR,coneSection,axialFactors,conveyorField,trapPosition} from '../src/optical-conveyor.js';
import {JET,jetModel} from '../src/nanojet.js';
import {SCHLIEREN} from '../src/schlieren.js';
const line=(d,stroke='#94bac7',width=1.4)=>`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"/>`;
const im=(href,x,y,w,h)=>`<image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"/>`;
async function write(id,body){await writeFile(new URL('../assets/previews/'+id+'.svg',import.meta.url),`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="184" viewBox="0 0 320 184">${body}</svg>`);}

// Section through the illuminated cylinder and the measured transverse profile.
{
 const model=jetModel(),w=172,h=104,v=new Float32Array(w*h),f=new Float64Array(10);
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){
   model.field((j/(h-1)-.5)*10,i/(w-1)*JET.length,f);v[j*w+i]=f[0]**2+f[1]**2;
 }
 const profile=[];
 for(let i=0;i<=90;i++){model.field(JET.scanHalf*(i/45-1),JET.scanZ,f);profile.push((i?'L':'M')+(218+i)+' '+(116-49*(f[0]**2+f[1]**2)/9.25).toFixed(2));}
 await write('nanojet',im(color(v,w,h),6,38,194,110)+'<ellipse cx="76.2" cy="93" rx="32.1" ry="26.4" stroke="#9dbfc8" stroke-width="1.2" fill="none"/>'+line('M210 119h102','#476170',1)+line(profile.join(' '),'#a9cdcd',2));
}

// An axial field section between two launch heads, with the occupied wells.
{
  const w=168,h=72,samples=new Float32Array(w*h);
  for(let j=0;j<h;j++){
    const section=coneSection(0,3*(2*j/(h-1)-1));
    for(let i=0;i<w;i++){
      const field=conveyorField(section,axialFactors(CONVEYOR.length*i/(w-1)));
      samples[j*w+i]=Math.hypot(field[0],field[1]);
    }
  }
  const head='<path d="M0 78h17l10-11h19l12 9v30l-12 9H27l-10-11H0z" stroke="#8299a3" fill="#2a3a44"/>'+line('M30 69v44m6-44v44m6-44v44','#6d8795',1.3);
  const beads=CONVEYOR.sites.map(s=>'<circle cx="'+(59+202*trapPosition(s,0)/CONVEYOR.length)+'" cy="91" r="3.1" fill="#f1d4a6"/>').join('');
  await write('conveyor',head+im(color(samples,w,h),59,43,202,96)+beads+'<g transform="translate(320) scale(-1 1)">'+head+'</g>');
}

// The Schlieren inset uses the calculated camera flux at the knife-edge setting.
{
  const model=prepareSpectralBench('schlieren'),f=benchPlane(model,SCHLIEREN.camera),n=112,values=new Float32Array(n*n);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const pixelsPerUnit=model.n/model.length;
    const p=(model.n/2+Math.round((1-2*j/(n-1))*9*pixelsPerUnit))*model.n+model.n/2+Math.round((2*i/(n-1)-1)*9*pixelsPerUnit);
    values[j*n+i]=Math.sqrt(Math.max(0,-(f[0].re[p]*f[2].re[p]+f[0].im[p]*f[2].im[p])));
  }
  const lenses=[40,144].map(x=>'<ellipse cx="'+x+'" cy="91" rx="5" ry="32" fill="#9fd4db22" stroke="#779ca6"/>').join('');
  await write('schlieren',line('M6 72 40 66 93 91 144 66 178 71 M6 110 40 116 93 91 144 116 178 111','#68949c')+lenses+'<path d="M92 91h16v35H92z" fill="#78919e" stroke="#bed0d3"/>'+line('M12 112v12m-2-15 4-2-4-2 4-2','#c79871',2)+im(color(values,n,n),187,29,126,126)+line('M187 29h126v126H187z','#38505b',1));
}
const e=acousticModel(1.72),w=204,h=124,v=new Float32Array(w*h),slice=new Float32Array(100*52);
for(let j=0;j<h;j++)for(let i=0;i<w;i++){const f=e.field((j/(h-1)*2-1)*22,i/(w-1)*45);v[j*w+i]=Math.hypot(f[0],f[1]);}
for(let j=0;j<52;j++)for(let i=0;i<100;i++){const f=e.field((i/99*2-1)*22,43);slice[j*100+i]=Math.abs(j-25.5)<10?Math.hypot(f[0],f[1]):0;}
await write('sound-cell',`<g transform="matrix(.95 -.17 .22 .64 4 63)">${im(color(v,w,h),0,0,w,h)}${line('M13 21v83M9 21v83','#a1c9cc',2)}${line('M9 105h9','#b68d67',5)}</g>${im(color(slice,100,52),230,58,85,64)}${line('M230 58h85v64h-85z','#2c404a',1)}`);
const m=drumModel(.13),n=184,pix=new Uint8Array(n*n*4);
for(let j=0;j<n;j++)for(let i=0;i<n;i++){const x=(2*i/(n-1)-1)*(DRUM.side/2+.12),z=DRUM.base+drumHeight*(1-j/(n-1)),f=m.field(x,z);
 const u=Math.min(1,Math.hypot(f[0],f[1])),phase=Math.atan2(f[1],f[0]),p=(j*n+i)*4;
 for(let c=0;c<3;c++)pix[p+c]=18+205*u*(.55+.43*Math.cos(phase+c*2*Math.PI/3));pix[p+3]=Math.abs(x)+(z-DRUM.base)/Math.sqrt(3)<=DRUM.side/2?255:0;}
const tri=png(n,n,pix);
// Camera pairs show two observations of the same hardware.
for (const [id,z,half] of [['hartmann',LENSLETS.arrayZ+LENSLETS.f,16],['speckle-focus',SCATTER.camera,10]]) {
  const model=prepareSpectralBench(id), alternate=prepareSpectralBench(id+'-bright');
  const base=benchPlane(model,z), difference=benchPlane(alternate,z);
  const size=112, first=new Float32Array(size*size), second=new Float32Array(size*size);
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){
    const x=(2*i/(size-1)-1)*half, y=(1-2*j/(size-1))*half;
    const p=(model.n/2+Math.round(y*model.n/model.length))*model.n+model.n/2+Math.round(x*model.n/model.length);
    for(const [mix,samples] of [[0,first],[1,second]]){
      let flux=0;
      for(const key of ['re','im'])flux-=(base[0][key][p]+mix*difference[0][key][p])*(base[2][key][p]+mix*difference[2][key][p]);
      samples[j*size+i]=Math.sqrt(Math.max(0,flux));
    }
  }
  const tile=(samples,x,y)=>im(color(samples,size,size),x,y,103,103)+line('M'+x+' '+y+'h103v103h-103z','#3b515b',1);
  let optic='';
  if(id==='hartmann'){
    for(let iy=0;iy<5;iy++)for(let ix=0;ix<5;ix++)
      optic+='<circle cx="'+(7+14*ix)+'" cy="'+(7+14*iy)+'" r="6.6" fill="#7994a04a" stroke="#87acba" stroke-width=".85"/>';
  }else{
    for(let iy=0;iy<8;iy++)for(let ix=0;ix<8;ix++)
      optic+='<rect x="'+ix*9+'" y="'+iy*9+'" width="8.4" height="8.4" fill="hsl(193 23% '+(30+16*Math.cos(alternate.regions[0].commands[8*iy+ix]))+'%)"/>';
  }
  await write(id,'<g transform="matrix(.75 -.14 .15 .95 6 60)">'+optic+'</g>'+tile(first,86,50)+tile(second,202,31));
}
await write('light-billiard',`<g transform="matrix(1 -.04 .25 .64 39 37)">${im(tri,0,0,206,167)}${line('M103 0 4 167h198z','#a6a397',2.3)}${line('M4 167v8h198v-8M4 175 103 8l99 167','#55717d',1.4)}</g>`);
const model=prepareSpectralBench('coronagraph'),n2=104,values=new Float32Array(n2*n2),plane=benchPlane(model,55.5);
for(let j=0;j<n2;j++)for(let i=0;i<n2;i++){const p=(64+Math.round((j/(n2-1)*2-1)*33))*128+64+Math.round((i/(n2-1)*2-1)*33);values[j*n2+i]=Math.sqrt(Math.max(0,-(plane[0].re[p]*plane[2].re[p]+plane[0].im[p]*plane[2].im[p])));}
await write('coronagraph',`<defs><linearGradient id="beam"><stop stop-color="#aedfe2" stop-opacity=".04"/><stop offset=".53" stop-color="#9acce2" stop-opacity=".4"/><stop offset="1" stop-color="#70b1cb" stop-opacity=".07"/></linearGradient></defs><path d="M7 78l60-13 48 24 52-33 31 6v52l-31-7-52-17-48 32-60-12z" fill="url(#beam)"/>${[24,65,115,166,193].map((x,i)=>`<ellipse cx="${x}" cy="${91-i*2}" rx="${i===2?3:5}" ry="${[20,35,11,36,27][i]}" fill="#82a8b8" fill-opacity=".12" stroke="#779da9" stroke-width="${i===4?3:1.2}"/>`).join('')}${im(color(values,n2,n2),211,34,101,109)}${line('M211 34h101v109H211z','#2c404a',1)}`);
