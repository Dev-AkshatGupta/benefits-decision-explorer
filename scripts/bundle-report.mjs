import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
const assets = [];
for (const name of (await readdir('dist/assets')).sort()) {
  const content = await readFile(`dist/assets/${name}`);
  assets.push({
    name,
    bytes: content.length,
    gzipBytes: gzipSync(content).length,
  });
}
await mkdir('docs/measurements', { recursive: true });
await writeFile(
  process.argv[2] ?? 'docs/measurements/bundle-current.json',
  JSON.stringify(
    {
      measuredAt: new Date().toISOString(),
      gzipMethod: 'Node gzipSync default options',
      assets,
    },
    null,
    2,
  ) + '\n',
);
