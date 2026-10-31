import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {randomBytes} from 'node:crypto';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {packageFields} from '../scripts/package-fields.mjs';
import {openFieldStream} from '../src/field-stream.js';

test('packaged downloads reconstruct and decompress the original bytes across arbitrary boundaries', async () => {
  const root = await mkdtemp(join(tmpdir(), 'diffract-fields-'));
  try {
    const source = join(root, 'source'), output = join(root, 'output');
    await mkdir(source);
    const original = randomBytes(6403), compressed = gzipSync(original);
    await writeFile(join(source, 'test.bin.gz'), compressed);
    const manifest = await packageFields(source, output, 257);
    const fetched = [];
    const fetcher = async url => {
      const name = new URL(url).pathname.split('/').pop();
      fetched.push(name);
      return new Response(await readFile(join(output, 'chunks', name)));
    };
    const stream = await openFieldStream('https://diffract.org/assets/fields/test.bin.gz', undefined, manifest, fetcher);
    const decoded = await new Response(stream.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    assert.deepEqual(Buffer.from(decoded), original);
    assert.deepEqual(fetched, manifest['test.bin.gz'].parts.map(part => part.file));
    assert.ok(manifest['test.bin.gz'].parts.every(part => part.bytes <= 257));
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('source development reads the original gzip file without a manifest', async () => {
  const bytes = gzipSync(Buffer.from('unchanged local development'));
  const stream = await openFieldStream('https://example.test/test.bin.gz', undefined, {}, async () => new Response(bytes));
  assert.deepEqual(Buffer.from(await new Response(stream).arrayBuffer()), bytes);
});

const url = 'https://example.test/assets/fields/test.bin.gz';
const manifest = {'test.bin.gz': {bytes: 6, parts: [{file: 'one.part', bytes: 3}, {file: 'two.part', bytes: 3}]}};

test('failed prefetch rejects the download instead of producing a partial field', async () => {
  const stream = await openFieldStream(url, undefined, manifest, async part =>
    new URL(part).pathname.endsWith('one.part') ? new Response('one') : new Response('missing', {status: 404}));
  await assert.rejects(new Response(stream).arrayBuffer(), /404/);
});

test('truncated chunks are rejected', async () => {
  const stream = await openFieldStream(url, undefined, manifest, async () => new Response('x'));
  await assert.rejects(new Response(stream).arrayBuffer(), /incomplete/);
});

test('changing experiments aborts the active and prefetched download', async () => {
  const controller = new AbortController(), signals = [];
  const stream = await openFieldStream(url, controller.signal, manifest, async (part, options) => {
    signals.push(options.signal);
    return new Response('one');
  });
  const reader = stream.getReader();
  assert.equal(new TextDecoder().decode((await reader.read()).value), 'one');
  controller.abort();
  await assert.rejects(reader.read(), {name: 'AbortError'});
  assert.ok(signals.length >= 2);
  assert.ok(signals.every(signal => signal.aborted));
});

test('cancelling the consumer also cancels prefetched transfers', async () => {
  const signals = [];
  const stream = await openFieldStream(url, undefined, manifest, async (part, options) => {
    signals.push(options.signal);
    return new Response('one');
  });
  const reader = stream.getReader();
  await reader.read();
  await reader.cancel();
  assert.ok(signals.every(signal => signal.aborted));
});

test('build refuses Git LFS pointers in place of the actual fields', async () => {
  const root = await mkdtemp(join(tmpdir(), 'diffract-pointer-'));
  try {
    const source = join(root, 'source');
    await mkdir(source);
    await writeFile(join(source, 'test.bin.gz'), 'version https://git-lfs.github.com/spec/v1\n');
    await assert.rejects(packageFields(source, join(root, 'output')), /git lfs pull/);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
