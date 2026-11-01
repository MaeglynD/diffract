import {JET,jetModel} from './nanojet.js';
let model;
function signal(x){
  model??=jetModel();
  const f=model.field(x,JET.scanZ);return f[0]**2+f[1]**2;
}
export function showJetScan(active){
  const graph=document.getElementById('jet-scan');graph.hidden=!active;
  if(!active||graph.dataset.drawn)return;
  const peak=signal(0),profile=[];
  for(let i=0;i<=200;i++){
    const value=signal(JET.scanHalf*(i/100-1))/peak;
    profile.push((i?'L':'M')+i+' '+(38-34*value).toFixed(2));
  }
  document.getElementById('jet-profile').setAttribute('d',profile.join(' '));graph.dataset.drawn='true';
}
export function updateJetScan(x){
  const value=signal(x),point=document.getElementById('jet-cursor');
  point.setAttribute('cx',100*(1+x/JET.scanHalf));point.setAttribute('cy',38-34*value/signal(0));
  document.getElementById('jet-value').textContent=value.toFixed(2);
}
