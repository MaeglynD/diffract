import * as THREE from 'three';
import {maskHalf} from './experiments.js';
import {addPlateMount,solid} from './setup-hardware.js';
import {forkLensHeight} from './element-relief.js';
import {loadGeometry} from './geometry-data.js';
export const plateHalf=maskHalf;
export const isProgrammable=e=>e.programmable||['bunny','rabbit','hologram'].includes(e.id);
const maps=new Map();
export function opticalMap(e){if(!maps.has(e.id)){let done,fail;const ready=new Promise((resolve,reject)=>{done=resolve;fail=reject;});const map=new THREE.TextureLoader().load('./assets/masks/'+e.id+'.surface.png',()=>done(),undefined,error=>{maps.delete(e.id);fail(error);});map.anisotropy=4;map.userData.shared=true;map.userData.ready=ready;maps.set(e.id,map);}return maps.get(e.id);}

const studio=()=>({studioTint:{value:new THREE.Color(1,1,1)},studioFill:{value:1},studioDirection:{value:new THREE.Vector3(-.4,.8,1).normalize()}});
function glassMaterial(){return new THREE.ShaderMaterial({transparent:false,depthWrite:true,depthTest:true,side:THREE.DoubleSide,uniforms:{opacity:{value:.62},...studio()},vertexShader:`attribute float transmission;varying vec3 n,v;varying float a;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);a=transmission;gl_Position=projectionMatrix*p;}`,fragmentShader:`uniform vec3 studioTint,studioDirection;uniform float studioFill;uniform float opacity;varying vec3 n,v;varying float a;void main(){vec3 N=normalize(n);if(!gl_FrontFacing)N=-N;vec3 V=normalize(v),L=normalize(studioDirection);float diffuse=.35+.65*abs(dot(N,L)),fresnel=pow(1.-abs(dot(N,V)),3.),spec=pow(max(0.,dot(N,normalize(L+V))),36.);vec3 color=vec3(.31,.49,.57)*diffuse*(.65+.35*sqrt(max(a,0.)))+vec3(.77,.91,.95)*(spec*.65+fresnel*.22);gl_FragColor=vec4(color*studioTint*studioFill,clamp((opacity/.62)*(.62*(.45+.3*fresnel)+.4*(1.-sqrt(clamp(a,0.,1.)))),0.,.92));}`});}
function sheetMaterial(map,cut=.5,display=false){return new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:{...studio(),map:{value:map},cut:{value:cut},opacity:{value:.62},display:{value:display}},vertexShader:`varying vec2 uv2;varying vec3 n,v;void main(){uv2=uv;vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,fragmentShader:`uniform vec3 studioTint,studioDirection;uniform float studioFill;uniform sampler2D map;uniform float cut,opacity;uniform bool display;varying vec2 uv2;varying vec3 n,v;void main(){vec4 t=texture2D(map,uv2);if(!display&&t.a<cut)discard;vec3 N=normalize(n),V=normalize(v);float edge=pow(1.-abs(dot(N,V)),3.),spec=pow(abs(dot(N,normalize(studioDirection+V))),38.);vec3 c=vec3(.10,.18,.22)+vec3(.12,.19,.21)*edge+vec3(.2,.27,.29)*spec;if(display){float trace=clamp((t.b-.52)*3.,0.,1.);float grid=step(.92,fract(uv2.x*160.))+step(.92,fract(uv2.y*160.));c=mix(vec3(.055,.12,.15),vec3(.30,.51,.55),trace*.7)+.013*grid;}gl_FragColor=vec4(c*studioTint*studioFill,pow(opacity,display?.28:.45));}`});}
export function makeOpticalElement(e,signal){
 const root=new THREE.Group(),h=plateHalf(e);root.userData.maskMap=opticalMap(e);root.userData.disposed=false;if(e.kind==='beams')return root;
 const phase=e.kind==='phase',glass=phase||e.kind==='axicon',programmable=isProgrammable(e);addPlateMount(root,h,programmable);root.userData.glass=glass;root.userData.surfaces=[];
 if(e.interfaceZ){const r=e.obstacleRadius,disc=solid(new THREE.CylinderGeometry(r,r,.28,96),new THREE.MeshStandardMaterial({color:0x253841,roughness:.27,metalness:.7}));disc.rotation.z=Math.PI/2;disc.position.x=e.interfaceZ;root.add(disc);const post=solid(new THREE.CylinderGeometry(.13,.13,h-r,16));post.position.set(e.interfaceZ,-(h+r)/2,0);root.add(post);const foot=solid(new THREE.BoxGeometry(3,.6,4));foot.position.set(e.interfaceZ,-h-.3,0);root.add(foot);}
 const sheet=(material,x)=>{const mesh=new THREE.Mesh(new THREE.PlaneGeometry(h*2,h*2),material);mesh.rotation.y=Math.PI/2;mesh.position.x=x;mesh.layers.set(5);root.add(mesh);root.userData.surfaces.push(material);};
 if(e.id==='fork'){
  // A literal amplitude grating in front of a continuous focusing profile.
  // Keeping these visible roles separate avoids presenting the wrapped lens
  // phase as a forest of unrelated glass stripes.
  const grating=sheetMaterial(root.userData.maskMap);grating.uniforms.plateExtent={value:h};grating.fragmentShader=`uniform float plateExtent,opacity;uniform vec3 studioTint;uniform float studioFill;varying vec2 uv2;void main(){vec2 p=(uv2-.5)*2.*plateExtent;float r=length(p),stripe=cos(6.28318530718*p.x/4.-atan(p.y,p.x));if(r<10.&&stripe>0.)discard;vec3 color=vec3(.12,.22,.27);gl_FragColor=vec4(color*studioTint*studioFill,pow(opacity,.3));}`;sheet(grating,.08);
  const nr=80,nt=192,pos=[],amp=[],indices=[];for(let j=0;j<=nr;j++)for(let i=0;i<=nt;i++){const r=10*j/nr,t=2*Math.PI*i/nt;pos.push(-.2-forkLensHeight(r),r*Math.sin(t),-r*Math.cos(t));amp.push(Math.exp(-r*r/49));}
  for(let j=0;j<nr;j++)for(let i=0;i<nt;i++){const a=j*(nt+1)+i,b=a+1,c=a+nt+1,d=c+1;indices.push(a,c,b,b,c,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('transmission',new THREE.Float32BufferAttribute(amp,1));g.setIndex(indices);g.computeVertexNormals();
  const coated=glassMaterial();coated.vertexShader='varying vec2 physical;'+coated.vertexShader.replace('void main(){','void main(){physical=vec2(-position.z,position.y);');coated.fragmentShader='varying vec2 physical;'+coated.fragmentShader.replace('gl_FragColor=vec4(color*studioTint*studioFill,','if(cos(6.28318530718*physical.x/4.-atan(physical.y,physical.x))<=0.){gl_FragColor=vec4(vec3(.09,.16,.19)*studioTint*studioFill,pow(opacity,.25));return;}gl_FragColor=vec4(color*studioTint*studioFill,');
  const lens=new THREE.Mesh(g,coated);lens.layers.set(5);root.add(lens);root.userData.glassMaterial=lens.material;return root;
 }
 if(glass&&!programmable)sheet(sheetMaterial(root.userData.maskMap,.85),.06);
 if(!glass){
  sheet(sheetMaterial(root.userData.maskMap),-.12);
  if(e.kind==='obstacle'){
   // The obstruction has an actual rim and thickness, not a dark image of a
   // hole. Its support is apparatus illustration, excluded from T(x,y).
   const disc=solid(new THREE.CylinderGeometry(4,4,.38,128),new THREE.MeshStandardMaterial({color:0x314751,roughness:.32,metalness:.72}));disc.rotation.z=Math.PI/2;disc.position.x=-.15;root.add(disc);
   const stem=solid(new THREE.CylinderGeometry(.1,.1,h-3.9,12));stem.position.set(-.15,-(h+4)/2,0);root.add(stem);
  }
 }else if(programmable){
  sheet(sheetMaterial(root.userData.maskMap,.5,true),-.12);
  for(const side of[-1,1])for(let j=0;j<12;j++){const pin=solid(new THREE.BoxGeometry(.3,.13,.7),new THREE.MeshStandardMaterial({color:0x647b7e,metalness:.65,roughness:.4}));pin.position.set(-.25,(j-5.5)*h/6,side*(h+.5));root.add(pin);}
 }else if(phase){
  root.userData.ready=loadGeometry('assets/elements/'+e.id+'.relief','relief',signal).then(({buffer,normals})=>{
   if(root.userData.disposed)return;const meta=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,0,1024)).split('\0')[0]),g=new THREE.BufferGeometry();
   g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(buffer,1024,meta.vertices*3),3));g.setAttribute('normal',new THREE.BufferAttribute(normals,3));g.setAttribute('transmission',new THREE.BufferAttribute(new Float32Array(buffer,1024+meta.vertices*12,meta.vertices),1));g.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer,1024+meta.vertices*16,meta.indices),1));
   const mesh=new THREE.Mesh(g,glassMaterial());mesh.layers.set(5);root.add(mesh);root.userData.glassMaterial=mesh.material;
  });
 }else{
  const height=.28*e.radius/.5,g=new THREE.ConeGeometry(e.radius,height,128,16,false);g.rotateZ(Math.PI/2);g.translate(-height/2,0,0);g.setAttribute('transmission',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(.8),1));const cone=new THREE.Mesh(g,glassMaterial());cone.layers.set(5);root.add(cone);root.userData.glassMaterial=cone.material;
 }
 return root;
}
