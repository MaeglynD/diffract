// Declutter short component names without covering the detector instruments.
export function layoutLabels(items,width,height,preview){
 const used=[],paths=[],compact=width<=650,font=compact?8:10,top=height<=540&&width>=height?92:compact?112:145;
 for(const {el,p} of items){
  if(getComputedStyle(el).display==='none')continue;
  const text=el.id==='optic-label'?el.querySelector('#optic-name').textContent:el.textContent;
  const w=Math.min(185,text.length*font*.54+12),h=el.id==='optic-label'?32:18;
  let chosen;
  for(const dy of[0,-22,22,-44,44,-66,66]){
   const x=Math.max(8+w/2,Math.min(width-8-w/2,p.x)),y=Math.max(top+h,Math.min(height-65,p.y+dy)),r={x:x-w/2,y:y-h,w,h};
   const overlap=a=>r.x<a.x+a.w+5&&r.x+r.w+5>a.x&&r.y<a.y+a.h+4&&r.y+r.h+4>a.y;
   const instrument=preview&&{x:preview.x-8,y:height-preview.y-preview.height-42,w:preview.width+16,h:preview.height+120};
   if(used.some(overlap)||instrument&&overlap(instrument))continue;chosen={x,y,r};break;
  }
  if(!chosen){el.hidden=true;continue;}
  const {x,y,r}=chosen;used.push(r);el.style.width=w+'px';el.style.transform=`translate(${r.x}px,${r.y}px)`;
  if(Math.hypot(x-p.x,y-p.y)>12)paths.push(`M${p.x.toFixed(1)} ${p.y.toFixed(1)}L${x.toFixed(1)} ${y.toFixed(1)}`);
 }
 const root=document.getElementById('label-links');if(!root.firstChild){root.appendChild(document.createElementNS('http://www.w3.org/2000/svg','path'));}root.firstChild.setAttribute('d',paths.join(''));
}
