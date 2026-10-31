import * as THREE from 'three';

// The same photographed-light shapes appear in the PBR metalwork and in the
// glass prepass. The latter writes display RGB and a separate optical alpha.
export const coatingUniforms = () => ({
  studioMap: {value:null}, studioMix: {value:0}
});
export const coatingGLSL = `
uniform sampler2D studioMap;
uniform float studioMix;
vec3 studioCoating(vec3 base, vec3 normal, vec3 view, float polish) {
  if (studioMix <= 0.) return base;
  vec3 d = (vec4(reflect(-view,normal),0.) * viewMatrix).xyz;
  vec3 a = abs(d);
  vec2 uv, tile;
  if (a.x>=a.y && a.x>=a.z) {
    uv=vec2(d.x>0.?d.z:-d.z,d.y)/a.x; tile=vec2(0.,d.x>0.?0.:1.);
  } else if (a.y>=a.z) {
    uv=vec2(-d.x,d.y>0.?-d.z:d.z)/a.y; tile=vec2(1.,d.y>0.?0.:1.);
  } else {
    uv=vec2(d.z>0.?-d.x:d.x,d.y)/a.z; tile=vec2(2.,d.z>0.?0.:1.);
  }
  // Sample the softly polished (32px face) level of the studio atlas.
  vec2 pixel=(uv*.5+.5)*30.+1.+tile*32.+vec2(0.,128.);
  vec3 light=texture2D(studioMap,pixel/vec2(336.,256.)).rgb*10.;
  float fresnel=.045+.955*pow(1.-abs(dot(normal,view)),5.);
  vec3 reflection=1.-exp(-light*(.14+.95*fresnel));
  return mix(base,base*.83+reflection*polish,studioMix);
}
`;

export function loadStudioMap() {
  return new THREE.TextureLoader().loadAsync(new URL('../assets/lighting/silver-studio.png',import.meta.url).href).then(map=>{
    map.mapping=THREE.CubeUVReflectionMapping;
    map.colorSpace=THREE.SRGBColorSpace;
    map.minFilter=map.magFilter=THREE.LinearFilter;
    map.generateMipmaps=false;
    return map;
  });
}

// Photograph the underside of the opaque hardware into a small height-weighted
// contact map. A change of camera or field phase can reuse the same photograph.
export class StudioTable {
  constructor() {
    this.hasSupport=false;
    this.map=new THREE.WebGLRenderTarget(512,512,{minFilter:THREE.LinearMipmapLinearFilter,generateMipmaps:true});
    this.camera=new THREE.OrthographicCamera();
    this.camera.layers.set(4);
    this.camera.up.set(0,0,1);
    this.depthInk=new THREE.ShaderMaterial({
      side:THREE.DoubleSide,
      uniforms:{floorY:{value:0},softHeight:{value:1}},
      vertexShader:`uniform float floorY,softHeight;varying float height;
        void main(){
          vec4 p=modelMatrix*vec4(position,1.);
          float h=max(0.,p.y-floorY);
          p.xz+=vec2(.27,-.20)*h;
          height=h/softHeight;
          gl_Position=projectionMatrix*viewMatrix*p;
        }`,
      fragmentShader:`varying float height;void main(){gl_FragColor=vec4(vec3(exp(-height)),1.);}`
    });
    this.surface=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({
      uniforms:{contact:{value:this.map.texture},strength:{value:0},
        floorShade:{value:new THREE.Color(.086,.101,.118)},floorLight:{value:new THREE.Color(.23,.258,.282)}},
      transparent:true,depthWrite:false,
      vertexShader:`varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform sampler2D contact;uniform float strength;uniform vec3 floorShade,floorLight;varying vec2 p;
        void main(){
          vec2 uv=vec2(p.x,1.-p.y);
          vec2 offset=(uv-.5)*2.;
          float fade=1.-smoothstep(.42,.98,length(offset));
          float shadow=.50*textureLod(contact,uv,1.3).r+
                       .34*textureLod(contact,uv,3.4).r+
                       .16*textureLod(contact,uv,4.9).r;
          float wash=exp(-3.4*dot(offset+vec2(.23,-.20),offset+vec2(.23,-.20)));
          vec3 slate=mix(floorShade,floorLight,wash);
          gl_FragColor=vec4(slate*(1.-.82*shadow),fade*strength*.88);
        }`
    }));
    this.surface.rotation.x=-Math.PI/2;
    this.surface.renderOrder=-20;
    this.surface.visible=false;
  }
  fit(roots,zMax,keyLight) {
    const bounds=new THREE.Box3(),part=new THREE.Box3();
    for(const root of roots) {
      root.updateWorldMatrix(true,true);
      root.traverseVisible(o=>{
        if(!o.isMesh || !o.layers.isEnabled(4)) return;
        if(o.material?.isMeshStandardMaterial) {
          o.castShadow=true;
          o.receiveShadow=true;
        }
        if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        bounds.union(part.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
      });
    }
    this.hasSupport=!bounds.isEmpty();
    if(!this.hasSupport) return;
    // The directional light looks at the world origin. Bound its orthographic
    // shadow camera around the solid apparatus, independently of the viewer.
    const extent=new THREE.Vector3().copy(bounds.min).multiplyScalar(-1).max(bounds.max).length()+1;
    const shadow=keyLight.shadow;
    Object.assign(shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:-extent,far:100+extent});
    shadow.camera.updateProjectionMatrix();
    shadow.normalBias=.0005*extent;
    bounds.max.x=Math.max(bounds.max.x,zMax*.8);
    const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
    const pad=Math.max(size.x*.22,size.z*.35,2);
    const width=size.x*1.55+2*pad, depth=size.z*1.75+2*pad;
    const floor=bounds.min.y-.03;
    this.surface.position.set(center.x,floor,center.z);
    this.surface.scale.set(width,depth,1);
    const camera=this.camera;
    camera.position.set(center.x,floor-1,center.z);
    camera.lookAt(center.x,center.y,center.z);
    Object.assign(camera,{left:-width/2,right:width/2,top:depth/2,bottom:-depth/2,near:.1,far:size.y+3});
    camera.updateProjectionMatrix();
    this.depthInk.uniforms.floorY.value=floor;
    this.depthInk.uniforms.softHeight.value=Math.max(.8,size.y*.20);
    this.dirty=true;
  }
  renderContact(renderer,scene,strength,movingParameter,keyLight) {
    this.surface.visible=this.hasSupport && strength>.001;
    if(!this.surface.visible) return;
    this.surface.material.uniforms.strength.value=strength;
    if(!this.dirty && (movingParameter==null || Math.abs(movingParameter-this.lastPosition)<.04)) return;
    this.dirty=false;
    this.lastPosition=movingParameter;
    keyLight.shadow.needsUpdate=true;
    const target=renderer.getRenderTarget(),background=scene.background;
    const clear=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
    const override=scene.overrideMaterial;
    scene.background=null;
    scene.overrideMaterial=this.depthInk;
    renderer.setRenderTarget(this.map);
    renderer.setClearColor(0,0);
    renderer.clear();
    renderer.render(scene,this.camera);
    renderer.setRenderTarget(target);
    scene.overrideMaterial=override;
    scene.background=background;
    renderer.setClearColor(clear,alpha);
  }
}
