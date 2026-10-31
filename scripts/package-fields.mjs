import {open, mkdir, readdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

export const CHUNK_BYTES = 16 * 1024 * 1024;

export async function packageFields(source, destination, chunkBytes = CHUNK_BYTES) {
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes < 1 || chunkBytes > 25 * 1024 * 1024) {
    throw new Error('Field chunks must be between 1 byte and 25 MiB.');
  }
  await mkdir(join(destination, 'chunks'), {recursive: true});
  const manifest = {};
  for (const name of (await readdir(source)).filter(name => name.endsWith('.bin.gz')).sort()) {
    const file = await open(join(source, name), 'r');
    try {
      const {size} = await file.stat();
      const signature = Buffer.alloc(2);
      await file.read(signature, 0, 2, 0);
      if (signature[0] !== 0x1f || signature[1] !== 0x8b) {
        throw new Error(`${name} is not a gzip volume. Run git lfs pull before building.`);
      }
      const buffer = Buffer.alloc(Math.min(chunkBytes, size));
      const hash = createHash('sha256'), parts = [];
      for (let offset = 0; offset < size;) {
        const length = Math.min(buffer.length, size - offset);
        let read = 0;
        while (read < length) {
          const {bytesRead} = await file.read(buffer, read, length - read, offset + read);
          if (!bytesRead) throw new Error(`Unexpected end of ${name}.`);
          read += bytesRead;
        }
        const bytes = buffer.subarray(0, length);
        hash.update(bytes);
        const partName = `${createHash('sha256').update(bytes).digest('hex')}.part`;
        await writeFile(join(destination, 'chunks', partName), bytes);
        parts.push({file: partName, bytes: length});
        offset += length;
      }
      manifest[name] = {bytes: size, sha256: hash.digest('hex'), parts};
    } finally {
      await file.close();
    }
  }
  if (!Object.keys(manifest).length) throw new Error('No field volumes found. Run git lfs pull before building.');
  return manifest;
}
