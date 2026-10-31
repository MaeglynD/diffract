// The static build replaces this map with content-addressed asset URLs.
export const spectrumAssets = {};
export function spectrumUrl(id){return new URL(`../assets/spectra/${spectrumAssets[id]?.file||id+'.spectrum.gz'}`,import.meta.url).href;}
