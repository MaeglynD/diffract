import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
await mkdir('artifacts/brand',{recursive:true});await mkdir('docs/media',{recursive:true});
function convert(args){const result=spawnSync('magick',args,{encoding:'utf8'});if(result.error)throw Error('ImageMagick must be available as magick.',{cause:result.error});if(result.status!==0)throw Error(result.stderr);}
convert(['-background','none','-density','288','assets/brand/favicon.svg','-resize','180x180','-depth','8','-strip','assets/brand/apple-touch-icon.png']);
convert(['-background','none','assets/brand/favicon.svg','-define','icon:auto-resize=48,32,16','assets/brand/favicon.ico']);
for(const [id,name] of [['trefoil','knots'],['metamorphosis','metamorphosis'],['healing','healing']]){
 // ImageMagick's SVG reader needs xlink for the embedded calculated PNGs.
 const source=(await readFile(`assets/previews/${id}.svg`,'utf8')).replace('<svg xmlns=','<svg xmlns:xlink="http://www.w3.org/1999/xlink" xmlns=').replaceAll('<image href=','<image xlink:href=');
 const file=`artifacts/brand/${id}-compatible.svg`;await writeFile(file,source);
 convert(['-background','#071119','-density','144',file,'-flatten','-depth','8','-strip',`docs/media/${name}.png`]);
}
console.log('Exported favicon sizes and README examples.');
