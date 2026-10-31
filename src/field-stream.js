import {fieldAssets,fieldBase} from './field-assets.js';

// Concatenate the original compressed bytes as a stream. Gzip decoding stays
// in the worker, and no second copy of the complete volume is buffered here.
export async function openFieldStream(url, signal, assets = fieldAssets, fetcher = fetch) {
  signal?.throwIfAborted();
  const name = new URL(url, import.meta.url).pathname.split('/').pop();
  const entry = assets[name];
  if (!entry) {
    const response = await fetcher(url, {signal});
    if (!response.ok || !response.body) throw new Error(`Field data unavailable (${response.status}).`);
    return response.body;
  }
  if (!entry.parts.length) throw new Error('Field data has no parts.');
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', abort, {once: true});
  const cleanup = () => signal?.removeEventListener('abort', abort);
  const request = part => fetcher(new URL(`chunks/${part.file}`, fieldBase||url), {signal: controller.signal})
    .then(response => {
      if (!response.ok || !response.body) throw new Error(`Field data unavailable (${response.status}).`);
      return {response};
    }, error => ({error})).catch(error => ({error}));
  let index = 0, reader, partBytes = 0, totalBytes = 0;
  // Prefetch only one part ahead, keeping memory bounded and transfers ordered.
  let pending = request(entry.parts[0]);
  return new ReadableStream({
    async pull(output) {
      try {
        controller.signal.throwIfAborted();
        while (index < entry.parts.length) {
          if (!reader) {
            const result = await pending;
            if (result.error) throw result.error;
            reader = result.response.body.getReader();
            pending = index + 1 < entry.parts.length ? request(entry.parts[index + 1]) : null;
          }
          const {done, value} = await reader.read();
          if (!done) {
            partBytes += value.byteLength;
            totalBytes += value.byteLength;
            if (partBytes > entry.parts[index].bytes) throw new Error('Field part has an unexpected length.');
            output.enqueue(value);
            return;
          }
          if (partBytes !== entry.parts[index].bytes) throw new Error('Field download was incomplete.');
          reader.releaseLock();
          reader = null;
          partBytes = 0;
          index++;
        }
        if (totalBytes !== entry.bytes) throw new Error('Field download was incomplete.');
        cleanup();
        output.close();
      } catch (error) {
        controller.abort(error);
        cleanup();
        output.error(error);
      }
    },
    async cancel(reason) {
      controller.abort(reason);
      cleanup();
      await reader?.cancel(reason).catch(() => {});
    }
  });
}
