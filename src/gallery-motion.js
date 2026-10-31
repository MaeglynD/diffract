// Keep the user's visual context. Only reveal cards which are outside the rail.
export function setupGalleryMotion(gallery){
 let animation=0,extent=0,width=0;
 const edges=()=>{gallery.classList.toggle('at-start',gallery.scrollLeft<5);gallery.classList.toggle('at-end',gallery.scrollLeft>extent-5);};
 const stop=()=>{cancelAnimationFrame(animation);animation=0;};
 const layout=()=>{const resized=width!==gallery.clientWidth;width=gallery.clientWidth;extent=Math.max(0,gallery.scrollWidth-width);edges();document.documentElement.style.setProperty('--catalog-bottom',`${Math.ceil(gallery.getBoundingClientRect().bottom+14)}px`);if(resized){const selected=gallery.querySelector('[aria-pressed=true]');if(selected)reveal(selected);}};
 new ResizeObserver(layout).observe(gallery);gallery.addEventListener('scroll',edges,{passive:true});
 gallery.addEventListener('pointerdown',stop,{passive:true});gallery.addEventListener('wheel',event=>{stop();if(extent>0&&Math.abs(event.deltaY)>Math.abs(event.deltaX)){gallery.scrollLeft+=event.deltaY;event.preventDefault();}},{passive:false});
 layout();
 function reveal(button){
  stop();const r=button.getBoundingClientRect(),g=gallery.getBoundingClientRect(),from=gallery.scrollLeft;
  const delta=r.left<g.left+20?r.left-g.left-20:r.right>g.right-20?r.right-g.right+20:0;
  const to=Math.max(0,Math.min(extent,from+delta));if(Math.abs(to-from)<1)return;
  let elapsed=0,last=performance.now();
  const tick=now=>{elapsed+=Math.min(32,now-last);last=now;const t=Math.min(1,elapsed/320),ease=1-(1-t)**3;gallery.scrollLeft=from+(to-from)*ease;edges();if(t<1)animation=requestAnimationFrame(tick);else animation=0;};
  animation=requestAnimationFrame(tick);
 }
 return reveal;
}
