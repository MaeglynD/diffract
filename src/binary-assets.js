export const binaryAssets = {};
export function binaryAsset(path){const entry=binaryAssets[path];return entry?{url:new URL('../assets/binary/'+entry.file,import.meta.url),compressed:true}:{url:new URL('../'+path,import.meta.url),compressed:false};}
