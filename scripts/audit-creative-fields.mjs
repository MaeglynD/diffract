import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {decodeVolume,sampleField,normalizedFlux} from '../src/volume-data.js';
import {imageTarget,IMAGE_DEPTHS,saturnCurves} from '../src/holographic-scenes.js';
const report={};
async function volume(id){const b=gunzipSync(await readFile(`assets/fields/${id}.bin.gz`));return decodeVolume(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}
function correlation(a,b){const ma=a.reduce((s,v)=>s+v,0)/a.length,mb=b.reduce((s,v)=>s+v,0)/b.length;let ab=0,aa=0,bb=0;for(let i=0;i<a.length;i++){ab+=(a[i]-ma)*(b[i]-mb);aa+=(a[i]-ma)**2;bb+=(b[i]-mb)**2;}return ab/Math.sqrt(aa*bb);}
const v=await volume('metamorphosis');report.images=[];
for(let k=0;k<3;k++){const z=IMAGE_DEPTHS[k],target=[],actual=[];for(let y=-8;y<=8;y+=.2)for(let x=-8;x<=8;x+=.2){target.push(imageTarget(k,x,y)**2);actual.push(normalizedFlux(sampleField(v,x,y,z)));}report.images.push({z,correlation:correlation(target,actual)});}
const s=await volume('saturn'),points=saturnCurves().flat();report.saturn={};
for(const dz of[0,-8,8]){let sum=0;for(const[x,y,z]of points)sum+=normalizedFlux(sampleField(s,x,y,z+dz));report.saturn[dz]=sum/points.length;}
function crossings(a,b,self=false){const out=[];for(let i=0;i<a.length;i++){const A=a[i],B=a[(i+1)%a.length],ax=B[0]-A[0],ay=B[1]-A[1];for(let j=self?i+2:0;j<b.length;j++){if(self&&i===0&&j===b.length-1)continue;const C=b[j],D=b[(j+1)%b.length],bx=D[0]-C[0],by=D[1]-C[1],d=ax*by-ay*bx;if(Math.abs(d)<1e-10)continue;const cx=C[0]-A[0],cy=C[1]-A[1],u=(cx*by-cy*bx)/d,t=(cx*ay-cy*ax)/d;if(u>0&&u<1&&t>0&&t<1){const za=A[2]+u*(B[2]-A[2]),zb=C[2]+t*(D[2]-C[2]);out.push({sign:Math.sign(d)*Math.sign(za-zb),separation:Math.abs(za-zb)});}}}return out;}
for(const id of['trefoil','hopf']){
 const field=await volume(id),{lines}=JSON.parse(await readFile(`assets/topology/${id}.json`));let max=0,sum=0,n=0;
 for(const line of lines)for(const[x,y,z]of line.points){const f=sampleField(field,x,y,z),a=Math.hypot(f[0],f[1])/field.maxE;max=Math.max(max,a);sum+=a*a;n++;}
 const paths=lines.map(l=>l.points.filter((p,j)=>j%4===0));const cross=id==='trefoil'?crossings(paths[0],paths[0],true):crossings(paths[0],paths[1]);
 report[id]={closed:lines.every(l=>l.closed),components:lines.length,crossings:cross,writhe:cross.reduce((s,c)=>s+c.sign,0),relativeZeroRms:Math.sqrt(sum/n),relativeZeroMax:max};
}
await writeFile('artifacts/creative-lab/field-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
