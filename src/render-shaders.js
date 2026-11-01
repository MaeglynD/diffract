import {splineShader} from './knife-response.js';

export const arrowFragment=`
uniform float daylightMix;uniform vec3 color;uniform sampler2D elementDepth,elementColor,guideDepth,guideColor;
uniform vec2 viewportSize,viewportOrigin;uniform bool showMask,showGuide;
varying float shade,alpha;
void main(){
 vec2 uv=(gl_FragCoord.xy-viewportOrigin)/viewportSize;float visibility=1.;
 if(showMask&&gl_FragCoord.z>texture2D(elementDepth,uv).r+.0000001)visibility*=1.-texture2D(elementColor,uv).a;
 if(showGuide&&gl_FragCoord.z>texture2D(guideDepth,uv).r+.0000001)visibility*=1.-texture2D(guideColor,uv).a;
 gl_FragColor=vec4(color*shade*(1.-.5*daylightMix),alpha*visibility);
}`;

export const arrowVertex=`
attribute vec3 origin,fieldReal,fieldImag,rightReal,rightImag,interference;attribute float carrier,envelope;
uniform float timePhase,gain,opacity,zMax,incidentLength,reveal,slitPhase;uniform bool readable,linearMix;uniform float auxiliaryMix;varying float shade,alpha;
void main(){
 float phase=6.28318530718*carrier-timePhase,c=linearMix?auxiliaryMix:cos(slitPhase)-1.,s=linearMix?0.:sin(slitPhase);vec3 re=fieldReal+c*rightReal-s*rightImag,im=fieldImag+s*rightReal+c*rightImag;vec3 field=re*cos(phase)-im*sin(phase);float localEnvelope=sqrt(max(0.,envelope*envelope+(c*c+s*s)*interference.x+2.*(c*interference.y+s*interference.z)));if(readable)field/=max(localEnvelope,.04);float amp=length(field);
 vec3 d=amp>.00001?field/amp:vec3(0.,1.,0.),ref=abs(d.z)<.85?vec3(0.,0.,1.):vec3(1.,0.,0.);
 vec3 side=normalize(cross(d,ref)),third=cross(side,d);float width=min(1.,amp*5.);
 vec3 pos=origin+d*position.y*amp*gain+(side*position.x+third*position.z)*width;
 vec3 norm=side*normal.x+d*normal.y+third*normal.z;shade=.88+.12*abs(dot(norm,normalize(vec3(-1.,2.,3.))));
 alpha=smoothstep(.015,.10,amp)*opacity*(1.-smoothstep(zMax-4.,zMax,origin.x))*reveal;
 if(origin.x<0.)alpha*=incidentLength>0.? .65:0.;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.);
}`;

const fieldSampling=`
uniform bool liveField;
#ifdef KNIFE_RESPONSE
uniform bool knifeBank;
#else
const bool knifeBank=false;
#endif
uniform sampler2D liveElectric,liveMagnetic,liveExtra;
uniform vec3 dimensions,bladeInterval;
#ifdef BLADE_DIRECT
${splineShader}
#endif
#ifdef KNIFE_RESPONSE
uniform vec3 knifeLayout;
vec4 bladeSample(sampler2D slices,highp sampler3D atlas,vec3 uv){
#ifdef BLADE_DIRECT
 return bladeField(atlas,uv);
#else
 vec3 p=(uv*dimensions-.5)/(dimensions-1.);
 float w=knifeLayout.x,cols=knifeLayout.y;
 float z=clamp((2.*p.z-1.)*(knifeLayout.z-1.),0.,knifeLayout.z-1.),a=floor(z),b=min(a+1.,knifeLayout.z-1.);
 vec2 xy=clamp(p.xy,0.,1.)*(w-1.)+.5,size=vec2(textureSize(slices,0));
 vec2 ua=(vec2(mod(a,cols),floor(a/cols))*w+xy)/size,ub=(vec2(mod(b,cols),floor(b/cols))*w+xy)/size;
 return mix(texture(slices,ua),texture(slices,ub),fract(z));
#endif
}
#endif
vec4 electricAt(vec3 uv){if(liveField)return texture(liveElectric,uv.xz);
#ifdef KNIFE_RESPONSE
 if(knifeBank&&uv.z>=.5)return bladeSample(liveElectric,rightElectric,uv);
#endif
 return texture(electricMap,uv);}
vec4 magneticAt(vec3 uv){if(liveField)return texture(liveMagnetic,uv.xz);
#ifdef KNIFE_RESPONSE
 if(knifeBank&&uv.z>=.5)return bladeSample(liveMagnetic,rightMagnetic,uv);
#endif
 return texture(magneticMap,uv);}
vec4 extraAt(vec3 uv){if(liveField)return texture(liveExtra,uv.xz);
#ifdef KNIFE_RESPONSE
 if(knifeBank&&uv.z>=.5)return bladeSample(liveExtra,rightExtra,uv);
#endif
 return texture(extraMap,uv);}
vec4 energyAt(vec3 uv){
#if defined(KNIFE_RESPONSE) && !defined(BLADE_DIRECT)
 if(knifeBank){if(uv.z<.5)return texture(energyMap,uv);return vec4(bladeSample(liveExtra,rightExtra,uv).b,0.,0.,0.);}
#endif
 if(liveField||knifeBank){
  vec4 e=electricAt(uv),b=magneticAt(uv),v=extraAt(uv);
  return vec4(.5*((liveField?v.a:1.)*dot(e,e)+dot(b,b)+dot(v.rg,v.rg)),0.,0.,0.);
 }return texture(energyMap,uv);
}`;

export const detectorFragment=`
precision highp float;precision highp sampler3D;
uniform sampler3D energyMap,electricMap,magneticMap,extraMap,rightElectric,rightMagnetic,rightExtra;

${fieldSampling}

uniform bool interferenceEnabled;uniform float slitPhase;uniform vec3 rightDimensions;
uniform vec3 positiveColor,negativeColor,lowColor,midColor,highColor;
uniform float halfWidth,zMax,incidentLength,plateHalf,timePhase,opacity,threshold,exposure,steps,reveal,phaseHue,axialFeather;
uniform int displayMode,phaseReference,planeSampling;
uniform bool linearMix;uniform float auxiliaryMix;
vec2 phaseDelta(vec2 v){float c=linearMix?auxiliaryMix:cos(slitPhase)-1.,s=linearMix?0.:sin(slitPhase);return vec2(c*v.x-s*v.y,s*v.x+c*v.y);}
uniform float viewHeight;uniform bool densityDetector,nativeField,fineSampling;uniform float interfaceZ,volumeContrast,fieldReference;uniform vec2 focusWindow;
float axialIndex(float z){return z/zMax*(dimensions.z-(interfaceZ>0.?2.:1.))+(interfaceZ>0.&&z>=interfaceZ?1.:0.);}
vec3 volumeUv(vec2 xy,float z){return vec3((xy*(dimensions.xy-1.)+.5)/dimensions.xy,(axialIndex(z)+.5)/dimensions.z);}
vec3 texturePoint(vec3 p){return volumeUv(vec2(-p.z/(2.*halfWidth)+.5,p.y/(2.*halfWidth)+.5),p.x);}
vec3 phaseColor(float phi){return .55+.43*cos(phi+phaseHue+vec3(0.,2.094395,4.18879));}
vec3 energyColor(float value){vec3 tint=mix(lowColor,midColor,clamp(value,0.,1.));return mix(tint,highColor,clamp((value-.55)*1.4,0.,.7));}
uniform vec2 detectorExtent;uniform float detectorZ,peak,detectorOpacity;uniform vec2 probe;uniform bool showProbe;uniform int nodalCount;uniform vec2 nodalPoints[12];
uniform vec2 planProbe;
vec4 samplePlane(vec2 xy,float sampleZ,vec2 probeCoord,bool plan){
 if(nativeField&&(abs((xy.y-.5)*2.*halfWidth)>viewHeight||sampleZ<0.||sampleZ>zMax))return vec4(.008,.021,.033,0.);
 vec3 uv=volumeUv(xy,sampleZ);
 vec2 e=electricAt(uv).rg,b=vec2(0.);
 if(displayMode==1)b=magneticAt(uv).rg;
 if(interferenceEnabled&&(linearMix?auxiliaryMix!=0.:slitPhase!=0.)){vec3 ruv=(vec3(xy,sampleZ/zMax)*(rightDimensions-1.)+.5)/rightDimensions;e+=phaseDelta(texture(rightElectric,ruv).rg);if(displayMode==1)b+=phaseDelta(texture(rightMagnetic,ruv).rg);}
 float value;vec3 color;float carrier=6.28318530718*sampleZ-timePhase;
 if(displayMode==1){float quantity=max(0.,-dot(e,b));if(densityDetector){if(interferenceEnabled&&(linearMix?auxiliaryMix!=0.:slitPhase!=0.)){vec3 ruv=(vec3(xy,sampleZ/zMax)*(rightDimensions-1.)+.5)/rightDimensions;vec4 ee=electricAt(uv),bb=magneticAt(uv),er=texture(rightElectric,ruv),br=texture(rightMagnetic,ruv);vec2 bz=extraAt(uv).rg+phaseDelta(texture(rightExtra,ruv).rg);ee+=vec4(phaseDelta(er.rg),phaseDelta(er.ba));bb+=vec4(phaseDelta(br.rg),phaseDelta(br.ba));quantity=.5*(dot(ee,ee)+dot(bb,bb)+dot(bz,bz));}else{vec4 d=energyAt(uv);vec3 f=fract(vec3(xy*(dimensions.xy-1.),axialIndex(sampleZ)));quantity=max(0.,d.r-.5*dot(f*(1.-f),d.gba));}}value=pow(clamp(quantity*exposure/max(peak,.000001),0.,1.),.43);color=mix(vec3(.008,.021,.033),energyColor(value),smoothstep(0.,.7,value));}
 else if(displayMode==0){float v=planeSampling==0?length(e)*.70710678118:dot(e,vec2(cos(carrier),-sin(carrier)));value=pow(clamp(abs(v)*exposure/sqrt(max(peak,.000001)),0.,1.),.65);color=mix(vec3(.008,.021,.033),v>=0.?positiveColor:negativeColor,value);}
 else{float phi=atan(e.y,e.x)+(phaseReference==1?carrier:0.);value=pow(clamp(length(e)*exposure/sqrt(max(peak,.000001)),0.,1.),.65);color=mix(vec3(.008,.021,.033),phaseColor(phi),value);}
 float annotationAlpha=0.;for(int i=0;i<12;i++){if(i>=nodalCount)break;float d=length((xy-nodalPoints[i])*2.*halfWidth),mark=1.-smoothstep(.035,.075,abs(d-.19));color=mix(color,vec3(.88,.98,1.),mark*.9);annotationAlpha=max(annotationAlpha,mark*.94);}
 if(showProbe){float ring=1.-smoothstep(.001,.004,abs(length(probeCoord-(plan?planProbe:probe))-.022));color=mix(color,vec3(.85,.97,1.),ring*.85);}
 return vec4(color,max(detectorOpacity*(.035+.965*value),annotationAlpha));
}

uniform bool isPreview,planPreview;uniform float previewAlpha,detectorZoom,previewAspect;in vec2 vUv;out vec4 outColor;
void main(){vec2 p=isPreview?(vUv-.5)/vec2(detectorZoom,detectorZoom*previewAspect)+.5:vUv;bool plan=isPreview&&planPreview;
 outColor=samplePlane(plan?vec2(p.x,.5):p,plan?zMax*.5+(p.y-.5)*2.*halfWidth:detectorZ,p,plan);if(isPreview)outColor.a=previewAlpha;}
`;

export const detectorVertex=`out vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;

export const volumeFragment=`
precision highp float;precision highp sampler3D;
uniform sampler3D energyMap,electricMap,magneticMap,extraMap,rightElectric,rightMagnetic,rightExtra;

${fieldSampling}

uniform bool interferenceEnabled;uniform float slitPhase;uniform vec3 rightDimensions;
uniform vec3 positiveColor,negativeColor,lowColor,midColor,highColor;
uniform float halfWidth,zMax,incidentLength,plateHalf,timePhase,opacity,threshold,exposure,steps,reveal,phaseHue,axialFeather;
uniform int displayMode,phaseReference,planeSampling;
uniform bool linearMix;uniform float auxiliaryMix;
vec2 phaseDelta(vec2 v){float c=linearMix?auxiliaryMix:cos(slitPhase)-1.,s=linearMix?0.:sin(slitPhase);return vec2(c*v.x-s*v.y,s*v.x+c*v.y);}
uniform float viewHeight;uniform bool densityDetector,nativeField,fineSampling;uniform float interfaceZ,volumeContrast,fieldReference;uniform vec2 focusWindow;
float axialIndex(float z){return z/zMax*(dimensions.z-(interfaceZ>0.?2.:1.))+(interfaceZ>0.&&z>=interfaceZ?1.:0.);}
vec3 volumeUv(vec2 xy,float z){return vec3((xy*(dimensions.xy-1.)+.5)/dimensions.xy,(axialIndex(z)+.5)/dimensions.z);}
vec3 texturePoint(vec3 p){return volumeUv(vec2(-p.z/(2.*halfWidth)+.5,p.y/(2.*halfWidth)+.5),p.x);}
vec3 phaseColor(float phi){return .55+.43*cos(phi+phaseHue+vec3(0.,2.094395,4.18879));}
vec3 energyColor(float value){vec3 tint=mix(lowColor,midColor,clamp(value,0.,1.));return mix(tint,highColor,clamp((value-.55)*1.4,0.,.7));}
uniform float daylightMix;
uniform vec2 detectorExtent;uniform float detectorZ,peak,detectorOpacity;uniform vec2 probe;uniform bool showProbe;uniform int nodalCount;uniform vec2 nodalPoints[12];
vec4 samplePlane(vec2 xy){
 if(nativeField&&densityDetector&&abs((xy.y-.5)*2.*halfWidth)>viewHeight)return vec4(.008,.021,.033,0.);
 vec3 uv=volumeUv(xy,detectorZ);
 vec2 e=electricAt(uv).rg,b=vec2(0.);
 if(displayMode==1)b=magneticAt(uv).rg;
 if(interferenceEnabled&&(linearMix?auxiliaryMix!=0.:slitPhase!=0.)){vec3 ruv=(vec3(xy,detectorZ/zMax)*(rightDimensions-1.)+.5)/rightDimensions;e+=phaseDelta(texture(rightElectric,ruv).rg);if(displayMode==1)b+=phaseDelta(texture(rightMagnetic,ruv).rg);}
 float value;vec3 color;float carrier=6.28318530718*detectorZ-timePhase;
 if(displayMode==1){float quantity=max(0.,-dot(e,b));if(densityDetector){if(interferenceEnabled&&(linearMix?auxiliaryMix!=0.:slitPhase!=0.)){vec3 ruv=(vec3(xy,detectorZ/zMax)*(rightDimensions-1.)+.5)/rightDimensions;vec4 ee=electricAt(uv),bb=magneticAt(uv),er=texture(rightElectric,ruv),br=texture(rightMagnetic,ruv);vec2 bz=extraAt(uv).rg+phaseDelta(texture(rightExtra,ruv).rg);ee+=vec4(phaseDelta(er.rg),phaseDelta(er.ba));bb+=vec4(phaseDelta(br.rg),phaseDelta(br.ba));quantity=.5*(dot(ee,ee)+dot(bb,bb)+dot(bz,bz));}else{vec4 d=energyAt(uv);vec3 f=fract(vec3(xy*(dimensions.xy-1.),axialIndex(detectorZ)));quantity=max(0.,d.r-.5*dot(f*(1.-f),d.gba));}}value=pow(clamp(quantity*exposure/max(peak,.000001),0.,1.),.43);color=mix(vec3(.008,.021,.033),energyColor(value),smoothstep(0.,.7,value));}
 else if(displayMode==0){float v=planeSampling==0?length(e)*.70710678118:dot(e,vec2(cos(carrier),-sin(carrier)));value=pow(clamp(abs(v)*exposure/sqrt(max(peak,.000001)),0.,1.),.65);color=mix(vec3(.008,.021,.033),v>=0.?positiveColor:negativeColor,value);}
 else{float phi=atan(e.y,e.x)+(phaseReference==1?carrier:0.);value=pow(clamp(length(e)*exposure/sqrt(max(peak,.000001)),0.,1.),.65);color=mix(vec3(.008,.021,.033),phaseColor(phi),value);}
 float annotationAlpha=0.;for(int i=0;i<12;i++){if(i>=nodalCount)break;float d=length((xy-nodalPoints[i])*2.*halfWidth),mark=1.-smoothstep(.035,.075,abs(d-.19));color=mix(color,vec3(.88,.98,1.),mark*.9);annotationAlpha=max(annotationAlpha,mark*.94);}
 if(showProbe){float ring=1.-smoothstep(.001,.004,abs(length(xy-probe)-.022));color=mix(color,vec3(.85,.97,1.),ring*.85);}
 float sensorBacking=mix(.035,.72,daylightMix);
 return vec4(color,max(detectorOpacity*mix(sensorBacking,1.,value),annotationAlpha));
}

uniform sampler2D sceneDepth,guideDepth,guideColor,maskMap,elementDepth,elementColor;
uniform vec3 fieldOrigin,fieldSign;uniform float travelMax;
uniform bool clipObject;uniform sampler2D objectFront;
uniform mat4 inverseProjection,inverseView;
uniform vec2 viewportSize,viewportOrigin;
uniform bool showMask,showDetector,showGuide;
uniform float maskOpacity;
in vec3 vWorld;out vec4 outColor;
float surfaceDistance(float depth,vec2 screen,vec3 rd){vec4 p=inverseProjection*vec4(screen*2.-1.,depth*2.-1.,1.);p/=p.w;p=inverseView*p;return dot(p.xyz-cameraPosition,rd);}
void over(inout vec4 acc,vec4 layer){acc.rgb+=(1.-acc.a)*layer.rgb*layer.a;acc.a+=(1.-acc.a)*layer.a;}
void sortSurfaces(inout float a,inout float b,inout vec4 ca,inout vec4 cb){if(a>b){float d=a;a=b;b=d;vec4 c=ca;ca=cb;cb=c;}}
void main(){
 vec3 worldRd=normalize(vWorld-cameraPosition),rd=worldRd*fieldSign,ro=(cameraPosition-fieldOrigin)*fieldSign;vec2 screen=(gl_FragCoord.xy-viewportOrigin)/viewportSize;
 vec3 lo=vec3(-incidentLength,-viewHeight,-halfWidth),hi=vec3(travelMax,viewHeight,halfWidth);
 vec3 aa=(lo-ro)/rd,bb=(hi-ro)/rd,nt=min(aa,bb),ft=max(aa,bb);
 float start=max(0.,max(nt.x,max(nt.y,nt.z))),end=min(ft.x,min(ft.y,ft.z));
 float opaque=texture(sceneDepth,screen).r;if(opaque<.999999)end=min(end,surfaceDistance(opaque,screen,worldRd));if(end<=start)discard;
 float sd[3];vec4 sc[3];for(int j=0;j<3;j++){sd[j]=end+2.;sc[j]=vec4(0.);}
 if(showMask){float depth=texture(elementDepth,screen).r;if(depth<.999999){float t=surfaceDistance(depth,screen,worldRd);if(t>=start-3.&&t<=end){sd[0]=max(start,t);sc[0]=texture(elementColor,screen);}}}
 if(showDetector&&abs(rd.x)>.00001){float t=(detectorZ-ro.x)/rd.x;vec3 p=ro+rd*t;if(t>=start&&t<=end&&abs(p.y)<=detectorExtent.y&&abs(p.z)<=detectorExtent.x){sd[1]=t;sc[1]=samplePlane(vec2(.5-p.z/(2.*halfWidth),.5+p.y/(2.*halfWidth)));}}
 if(showGuide){float depth=texture(guideDepth,screen).r;if(depth<.999999){float t=surfaceDistance(depth,screen,worldRd);if(t>=start&&t<=end){sd[2]=t;sc[2]=texture(guideColor,screen);}}}
 sortSurfaces(sd[0],sd[1],sc[0],sc[1]);sortSurfaces(sd[1],sd[2],sc[1],sc[2]);sortSurfaces(sd[0],sd[1],sc[0],sc[1]);
 float count=min(steps,max(1.,ceil((end-start)/(fineSampling?.07:displayMode==1?.28:.21)))),ds=(end-start)/count;vec4 acc=vec4(0.);int surface=0;
 for(int i=0;i<512;i++){
  if(float(i)>=count||acc.a>.985)break;float t=start+(float(i)+.5)*ds;
  for(int j=0;j<3;j++){if(surface>=3||sd[surface]>t)break;over(acc,sc[surface]);surface++;}
  vec3 p=ro+rd*t;vec4 e;float window;
  if(p.x<0.){window=(1.-smoothstep(plateHalf*.9,plateHalf*.94,length(p.yz)))*smoothstep(-incidentLength,-incidentLength+.6,p.x)*.08;e=vec4(1.,0.,0.,0.);}
  else{window=(nativeField?(1.-smoothstep(halfWidth*.92,halfWidth,abs(p.z)))*(1.-smoothstep(viewHeight*.88,viewHeight,abs(p.y))):(1.-smoothstep(halfWidth*.82,halfWidth,max(abs(p.y),abs(p.z))))*(1.-smoothstep(zMax-max(7.,zMax*.15),zMax,p.x)));if(window<.001)continue;e=displayMode==1&&(!interferenceEnabled||(linearMix?auxiliaryMix==0.:slitPhase==0.))?vec4(0.):electricAt(texturePoint(p));if(interferenceEnabled&&(linearMix?auxiliaryMix!=0.:slitPhase!=0.)){vec3 ruv=(vec3(-p.z/(2.*halfWidth)+.5,p.y/(2.*halfWidth)+.5,p.x/zMax)*(rightDimensions-1.)+.5)/rightDimensions;e+=vec4(phaseDelta(texture(rightElectric,ruv).rg),phaseDelta(texture(rightElectric,ruv).ba));}}
  if(axialFeather>0.)window*=1.-smoothstep(zMax-axialFeather,zMax,p.x);
  if(clipObject){float front=texture(objectFront,vec2(.5-p.z/(2.*halfWidth),.5+p.y/(2.*halfWidth))).r;window*=1.-smoothstep(front-.3,front+.05,p.x);}
  if(focusWindow.x>0.)window*=.06+.94*smoothstep(focusWindow.x-5.,focusWindow.x,p.x)*(1.-smoothstep(focusWindow.y,focusWindow.y+5.,p.x));
  if(window<.001)continue;float phase=6.28318530718*p.x-timePhase,strength;vec3 tint;
  if(displayMode==0){float value=dot(e.rg,vec2(cos(phase),-sin(phase)));strength=abs(value)*exposure;tint=value>=0.?positiveColor:negativeColor;}
  else if(displayMode==1){if(p.x>=0.&&(!interferenceEnabled||(linearMix?auxiliaryMix==0.:slitPhase==0.))){vec4 density=energyAt(texturePoint(p));vec3 fraction=fract(vec3(vec2(.5-p.z/(2.*halfWidth),.5+p.y/(2.*halfWidth))*(dimensions.xy-1.),axialIndex(p.x)));strength=sqrt(max(0.,density.r-.5*dot(fraction*(1.-fraction),density.gba)))*exposure;tint=energyColor(strength/(nativeField?1.8*max(fieldReference,.001):1.));}else{vec4 b=vec4(-1.,0.,0.,0.);vec2 bz=vec2(0.);if(p.x>=0.){vec3 uv=texturePoint(p);b=magneticAt(uv);bz=extraAt(uv).rg;if(interferenceEnabled&&(linearMix?auxiliaryMix!=0.:slitPhase!=0.)){vec3 ruv=(vec3(-p.z/(2.*halfWidth)+.5,p.y/(2.*halfWidth)+.5,p.x/zMax)*(rightDimensions-1.)+.5)/rightDimensions;vec4 br=texture(rightMagnetic,ruv);b+=vec4(phaseDelta(br.rg),phaseDelta(br.ba));bz+=phaseDelta(texture(rightExtra,ruv).rg);}}strength=sqrt(.5*(dot(e,e)+dot(b,b)+dot(bz,bz)))*exposure;tint=energyColor(strength/(nativeField?1.8*max(fieldReference,.001):1.));}}
  else{strength=length(e.rg)*exposure;tint=phaseColor(atan(e.y,e.x)+(phaseReference==1?phase:0.));}
  strength=max(strength-threshold,0.);strength=pow(strength/max(fieldReference,.001),volumeContrast)*max(fieldReference,.001);float alpha=1.-exp(-.9044*opacity*(28./max(zMax,28.))*strength*window*ds);
  // Separate hues on a pale ground while preserving the transfer function for opacity.
  if(daylightMix>0.){
    float core=smoothstep(.12,.68,strength/max(fieldReference,.001));
    vec3 ink=.86*tint-.58*min(tint.r,min(tint.g,tint.b));
    vec3 highlight=mix(tint,vec3(1.,.99,.96),.13);
    tint=mix(tint,mix(ink,highlight,core),daylightMix);
  }
  over(acc,vec4(tint,alpha));
 }
 for(int j=0;j<3;j++){if(surface<3&&sd[surface]<=end){over(acc,sc[surface]);surface++;}}
 if(acc.a<.002)discard;outColor=vec4(acc.rgb/max(acc.a,.0001),acc.a*reveal);
}`;

export const volumeVertex=`out vec3 vWorld;void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;

