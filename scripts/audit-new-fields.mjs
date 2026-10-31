import {mkdir,writeFile} from 'node:fs/promises';
import {buildSpectrum,experiment,GRID} from '../src/experiments.js';
import {propagate,fluxZ,sampleComplex} from '../src/physics.js';
import {airyAi} from '../src/advanced-fields.js';
const reports={airyValues:[-8,-5,-2.338107410459767,-1,0,1,3,5].map(x=>[x,airyAi(x)]),experiments:{}};
for(const id of ['autofocus','fork','astigmatism','poisson']){
  const s=buildSpectrum(id),e=experiment(id),rows=[];
  for(let z=0;z<=e.zMax;z+=2){
    const [ey,bx]=propagate(s,z,[0,2]);
    let power=0,peak=0,xx=0,yy=0,local=0,peakX=0,peakY=0;
    for(let j=0;j<GRID.n;j++)for(let i=0;i<GRID.n;i++){
      const x=(i-GRID.n/2)*.25,y=(j-GRID.n/2)*.25,v=fluxZ(ey,bx,j*GRID.n+i);
      power+=v*.25**2;if(v>peak){peak=v;peakX=x;peakY=y;}
      if(Math.abs(x)<10&&Math.abs(y)<10){local+=v;xx+=v*x*x;yy+=v*y*y;}
    }
    const at=GRID.n/2*GRID.n+GRID.n/2;
    rows.push({z,power,peak,peakX,peakY,axis:fluxZ(ey,bx,at),sigmaX:Math.sqrt(xx/local),sigmaY:Math.sqrt(yy/local)});
  }
  const detail={rows};
  if(id==='fork'){
    const z=30,[ey]=propagate(s,z,[0]);
    detail.winding=[];
    for(const cx of [-8,8])for(const radius of [.5,1,1.5,2]){
      let sum=0,last;
      for(let j=0;j<=256;j++){
        const theta=j*2*Math.PI/256,[re,im]=sampleComplex(ey,cx+radius*Math.cos(theta),radius*Math.sin(theta),GRID),p=Math.atan2(im,re);
        if(last!==undefined)sum+=Math.atan2(Math.sin(p-last),Math.cos(p-last));last=p;
      }
      detail.winding.push({z,cx,radius,charge:sum/(2*Math.PI)});
    }
  }
  reports.experiments[id]=detail;
  console.log(id,JSON.stringify({brightest:rows.reduce((a,b)=>b.peak>a.peak?b:a),axisFocus:rows.reduce((a,b)=>b.axis>a.axis?b:a),initial:rows[0],winding:detail.winding,waistX:rows.reduce((a,b)=>b.sigmaX<a.sigmaX?b:a),waistY:rows.reduce((a,b)=>b.sigmaY<a.sigmaY?b:a)}));
}
await mkdir('artifacts/physics-audit',{recursive:true});
await writeFile('artifacts/physics-audit/new-fields.json',JSON.stringify(reports,null,2));
