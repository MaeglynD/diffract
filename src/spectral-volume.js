import {HEADER_BYTES} from './volume-data.js';

export function decodeSpectrum(buffer){
 if(buffer.byteLength<HEADER_BYTES)throw Error('Incomplete angular spectrum');
 const header=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,0,HEADER_BYTES)).split('\0')[0]);
 if(header.version!==1)throw Error('Unsupported angular spectrum');
 if(header.side!==header.radius*2+1||![1,2].includes(header.sources)||buffer.byteLength!==HEADER_BYTES+header.side**2*header.sources*16)throw Error('Invalid angular spectrum size');
 return {...header,data:new Float64Array(buffer,HEADER_BYTES)};
}

const vertex=`#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}`;
const common=`#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
layout(location=0)out vec4 o0;layout(location=1)out vec4 o1;layout(location=2)out vec4 o2;
vec2 mul(vec2 a,vec2 b){return vec2(a.x*b.x-a.y*b.y,a.x*b.y+a.y*b.x);}
`;
const init=common+`
uniform sampler2D source;uniform int n;uniform float length;uniform float z;
int reverse(int v){int r=0;for(int bits=n;bits>1;bits>>=1){r=(r<<1)|(v&1);v>>=1;}return r;}
void main(){ivec2 p=ivec2(gl_FragCoord.xy),f=ivec2(reverse(p.x),reverse(p.y));vec4 a=texelFetch(source,f,0);vec2 q=vec2(f.x<n/2?f.x:f.x-n,f.y<n/2?f.y:f.y-n)/length;
 float qz=sqrt(max(.0001,1.-dot(q,q))),angle=6.283185307179586*a.z*z;vec2 w=mul(a.xy,vec2(cos(angle),sin(angle)));
 o0=vec4(w,w*(-q.y/qz));o1=vec4(w*(-(1.-q.x*q.x)/qz),w*(q.x*q.y/qz));o2=vec4(w*q.x,0.,0.);
}`;
const butterfly=common+`
uniform sampler2D t0,t1,t2;uniform int span;uniform int axis;
vec4 transform(sampler2D t,ivec2 a,ivec2 b,vec2 w){vec4 A=texelFetch(t,a,0),B=texelFetch(t,b,0);return .5*(A+vec4(mul(B.xy,w),mul(B.zw,w)));}
void main(){ivec2 p=ivec2(gl_FragCoord.xy),a=p,b=p;int index=axis==0?p.x:p.y;int j=index%(span*2),base=index-j+j%span;
 if(axis==0){a.x=base;b.x=base+span;}else{a.y=base;b.y=base+span;}float angle=3.141592653589793*float(j)/float(span);vec2 w=vec2(cos(angle),sin(angle));
 o0=transform(t0,a,b,w);o1=transform(t1,a,b,w);o2=transform(t2,a,b,w);
}`;
const crop=`#version 300 es
precision highp float;precision highp int;precision highp sampler2D;
layout(location=0)out uvec4 o0;layout(location=1)out uvec4 o1;layout(location=2)out uvec4 o2;
uniform sampler2D t0,t1,t2;uniform float n,length,halfWidth;uniform int rowOffset;uniform vec2 dimensions;
vec4 sampleMap(sampler2D t,vec2 p){ivec2 a=ivec2(floor(p));vec2 f=fract(p);return mix(mix(texelFetch(t,a,0),texelFetch(t,a+ivec2(1,0),0),f.x),mix(texelFetch(t,a+ivec2(0,1),0),texelFetch(t,a+ivec2(1,1),0),f.x),f.y);}
void samplePoint(int i,out vec4 a,out vec4 b,out vec4 c){vec2 pixel=vec2(i%int(dimensions.x),i/int(dimensions.x));vec2 xy=(pixel/(dimensions-1.)*2.-1.)*halfWidth,p=xy*n/length+n*.5;
 a=sampleMap(t0,p);b=sampleMap(t1,p);c=sampleMap(t2,p);c.z=dot(a,a);c.w=-dot(a.xy,b.xy);
}
uint halfBits(float value){uint bits=floatBitsToUint(value),sign=(bits>>16u)&32768u,m=bits&8388607u;int exponent=int((bits>>23u)&255u)-112;
 if(exponent>=31)return sign|31744u|((((bits>>23u)&255u)==255u&&m!=0u)?512u:0u);
 if(exponent<=0){if(exponent < -10)return sign;return sign|((((m|8388608u)>>uint(1-exponent))+4096u)>>13u);}
 return sign|((uint(exponent)<<10u)+((m+4096u)>>13u));}
uint pair(vec2 v){return halfBits(v.x)|(halfBits(v.y)<<16u);}
uvec4 pack(vec4 a,vec4 b){return uvec4(pair(a.xy),pair(a.zw),pair(b.xy),pair(b.zw));}
void main(){int i=((int(gl_FragCoord.y)-rowOffset)*int(dimensions.x)+int(gl_FragCoord.x))*2;vec4 a,b,c,d,e,f;samplePoint(i,a,b,c);samplePoint(min(i+1,int(dimensions.x*dimensions.y)-1),d,e,f);o0=pack(a,d);o1=pack(b,e);o2=pack(c,f);
}`;

// Float32 FFT arithmetic, retaining every mode of the original Float64 angular
// spectrum. Output uses exactly the original grid, components and binary16 format.
export class SpectralVolume {
 constructor({initShader=init}={}){
  const canvas=new OffscreenCanvas(1,1),gl=this.gl=canvas.getContext('webgl2',{antialias:false,depth:false,stencil:false,alpha:false});
  if(!gl||!gl.getExtension('EXT_color_buffer_float'))throw Error('Floating-point field reconstruction is unavailable');
  this.programs=[initShader,butterfly,crop].map(fragment=>{
   const program=gl.createProgram();for(const[type,source]of[[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader);gl.deleteShader(shader);}gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));return program;
  });
  this.locations=this.programs.map(p=>new Map());gl.bindVertexArray(gl.createVertexArray());this.resources=[];this.n=0;
 }
 texture(width,height,data=null,integer=false){const gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,integer?gl.RGBA32UI:gl.RGBA32F,width,height,0,integer?gl.RGBA_INTEGER:gl.RGBA,integer?gl.UNSIGNED_INT:gl.FLOAT,data);return t;}
 target(width,height,integer=false){const gl=this.gl,f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);const textures=Array.from({length:3},(_,i)=>{const t=this.texture(width,height,null,integer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0+i,gl.TEXTURE_2D,t,0);return t;});gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1,gl.COLOR_ATTACHMENT2]);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Field framebuffer unavailable');return{f,textures,width,height};}
 release(target){if(!target)return;target.textures.forEach(t=>this.gl.deleteTexture(t));this.gl.deleteFramebuffer(target.f);}
 use(index,target,inputs,values){const gl=this.gl,p=this.programs[index];gl.useProgram(p);gl.bindFramebuffer(gl.FRAMEBUFFER,target.f);gl.viewport(0,values.rowOffset||0,target.width,target.sliceHeight||target.height);
  const locations=this.locations[index],location=key=>{if(!locations.has(key))locations.set(key,gl.getUniformLocation(p,key));return locations.get(key);};
  inputs.forEach((t,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,t);gl.uniform1i(location(index===0?'source':'t'+i),i);});
  for(const[key,value]of Object.entries(values)){const loc=location(key);if(Array.isArray(value))gl.uniform2fv(loc,value);else if(['span','axis','rowOffset'].includes(key)||key==='n'&&index===0)gl.uniform1i(loc,value);else gl.uniform1f(loc,value);}gl.drawArrays(gl.TRIANGLES,0,3);
 }
 async readBatch(target,pixels,rows,layers,signal,pack){
  const gl=this.gl,bytes=pixels.byteLength;gl.bindBuffer(gl.PIXEL_PACK_BUFFER,pack);
  for(let c=0;c<3;c++){gl.readBuffer(gl.COLOR_ATTACHMENT0+c);gl.readPixels(0,0,target.width,rows*layers,gl.RGBA_INTEGER,gl.UNSIGNED_INT,c*bytes);}
  const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();
  try{for(;;){signal?.throwIfAborted();const status=gl.clientWaitSync(fence,0,0);if(status===gl.WAIT_FAILED)throw Error('Field readback failed');if(status!==gl.TIMEOUT_EXPIRED)break;await new Promise(resolve=>setTimeout(resolve,1));}}
  finally{gl.deleteSync(fence);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);}
 }
 async generate(spectrum,quality='full',signal,progress=()=>{}){
  signal?.throwIfAborted();
  const gl=this.gl,meta=spectrum[quality],{length}=meta.grid,n=quality==='preview'?meta.grid.n/2:meta.grid.n,{nx,ny,nz}=meta,count=nx*ny*4,buffer=new ArrayBuffer(HEADER_BYTES+count*nz*6),out=[0,1,2].map(i=>new Uint16Array(buffer,HEADER_BYTES+i*count*nz*2,count*nz));
  new Uint8Array(buffer,0,HEADER_BYTES).set(new TextEncoder().encode(JSON.stringify(meta)));
  if(this.n!==n){this.resources.forEach(t=>this.release(t));this.resources=[this.target(n,n),this.target(n,n)];this.n=n;}
  const sources=Array.from({length:spectrum.sources},(_,s)=>{const data=new Float32Array(n*n*4);for(let y=-spectrum.radius;y<=spectrum.radius;y++)for(let x=-spectrum.radius;x<=spectrum.radius;x++){
   const at=(((y+n)%n)*n+(x+n)%n)*4,p=(s*spectrum.side*spectrum.side+(y+spectrum.radius)*spectrum.side+x+spectrum.radius)*2,scale=(n/meta.grid.n)**2;data[at]=spectrum.data[p]*scale;data[at+1]=spectrum.data[p+1]*scale;data[at+2]=Math.sqrt(1-(x*x+y*y)/(length*length))-1;
  }return this.texture(n,n,data);});
  const batch=4,rows=Math.ceil(ny/2),result=this.target(nx,rows*batch,true),pixels=new Uint32Array(result.width*result.height*4),halves=new Uint16Array(pixels.buffer),readStride=nx*rows*8,cut=meta.interfaceZ?Math.round(meta.interfaceZ/meta.zMax*(nz-2)):-1;result.sliceHeight=rows;
  const pack=gl.createBuffer();gl.bindBuffer(gl.PIXEL_PACK_BUFFER,pack);gl.bufferData(gl.PIXEL_PACK_BUFFER,pixels.byteLength*3,gl.STREAM_READ);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
  try{for(let start=0;start<nz;start+=batch){const layers=Math.min(batch,nz-start);for(let iz=start;iz<start+layers;iz++){
   signal?.throwIfAborted();const z=cut<0?iz*meta.zMax/(nz-1):(iz<=cut?iz:iz-1)*meta.zMax/(nz-2),after=cut>=0&&iz>cut;let current=0;
   this.use(0,this.resources[current],[sources[after?1:0]],{n,length,z:after?z-meta.interfaceZ:iz===cut?z-1e-7:z});
   for(let axis=0;axis<2;axis++)for(let span=1;span<n;span*=2){this.use(1,this.resources[1-current],this.resources[current].textures,{axis,span});current=1-current;}
   this.use(2,result,this.resources[current].textures,{n,length,halfWidth:meta.half,dimensions:[nx,ny],rowOffset:(iz-start)*rows});
   }
   await this.readBatch(result,pixels,rows,layers,signal,pack);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,pack);
   for(let c=0;c<3;c++){gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,c*pixels.byteLength,pixels);for(let layer=0;layer<layers;layer++)out[c].set(halves.subarray(layer*readStride,layer*readStride+count),(start+layer)*count);}gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
   progress((start+layers)/nz);await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(gl.getError()!==gl.NO_ERROR)throw Error('GPU field reconstruction failed');return buffer;
  }finally{gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);gl.deleteBuffer(pack);sources.forEach(t=>gl.deleteTexture(t));this.release(result);}
 }
}
