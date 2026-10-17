import { copyFile, writeFile } from 'node:fs/promises';

await Promise.all([
  copyFile('dist/index.html', 'dist/404.html'),
  writeFile('dist/.nojekyll', ''),
]);
