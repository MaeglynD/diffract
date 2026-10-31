// Explicit motion also works when the OS disables native smooth scrolling.
// Pointer/wheel input always takes over immediately from a selection transition.
export function setupGalleryMotion(gallery){
 let animation=0;
 const edges=()=>{gallery.classList.toggle('at-start',gallery.scrollLeft<5);gallery.classList.toggle('at-end',gallery.scrollLeft>gallery.scrollWidth-gallery.clientWidth-5);};
 const stop=()=>{cancelAnimationFrame(animation);animation=0;};
 const layout=()=>{edges();document.documentElement.style.setProperty('--catalog-bottom',`${Math.ceil(gallery.getBoundingClientRect().bottom+14)}px`);};
 new ResizeObserver(layout).observe(gallery);gallery.addEventListener('scroll',edges,{passive:true});
 gallery.addEventListener('pointerdown',stop,{passive:true});gallery.addEventListener('wheel',event=>{stop();if(gallery.scrollWidth>gallery.clientWidth&&Math.abs(event.deltaY)>Math.abs(event.deltaX)){gallery.scrollLeft+=event.deltaY;event.preventDefault();}},{passive:false});
 layout();
 return button=>{
  stop();const r=button.getBoundingClientRect(),g=gallery.getBoundingClientRect(),from=gallery.scrollLeft,to=Math.max(0,Math.min(gallery.scrollWidth-gallery.clientWidth,from+r.left-g.left-(gallery.clientWidth-r.width)/2)),delta=to-from;
  gallery.dataset.motion=JSON.stringify({from,to,delta,width:gallery.clientWidth,scrollWidth:gallery.scrollWidth,left:r.left,rectLeft:g.left,rectWidth:g.width});if(Math.abs(delta)<1){edges();return;}
  const start=performance.now(),duration=Math.min(620,360+Math.abs(delta)*.12);
  const tick=now=>{const t=Math.min(1,(now-start)/duration),ease=t*t*t*(10+t*(-15+6*t));gallery.scrollLeft=from+delta*ease;edges();if(t<1)animation=requestAnimationFrame(tick);else {animation=0;gallery.dataset.motionEnd=String(gallery.scrollLeft);}};
  animation=requestAnimationFrame(tick);
 };
}
