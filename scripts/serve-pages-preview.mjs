import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const root = resolve('dist');
const basePath = '/benefits-decision-explorer/';
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.woff2', 'font/woff2'],
]);

createServer(async (request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  if (!pathname.startsWith(basePath)) {
    response.writeHead(404).end();
    return;
  }

  const requestedPath = decodeURIComponent(pathname.slice(basePath.length));
  const file = resolve(root, requestedPath || 'index.html');
  const isWithinDist = file === root || file.startsWith(root + sep);
  let fileInfo;
  if (isWithinDist) {
    try {
      fileInfo = await stat(file);
    } catch {
      fileInfo = undefined;
    }
  }

  const isPageRoute = !extname(requestedPath);
  const servedFile = fileInfo?.isFile()
    ? file
    : isPageRoute
      ? resolve(root, '404.html')
      : undefined;
  if (!servedFile) {
    response.writeHead(404).end();
    return;
  }

  response.writeHead(fileInfo?.isFile() ? 200 : 404, {
    'Content-Type':
      contentTypes.get(extname(servedFile)) ?? 'application/octet-stream',
  });
  createReadStream(servedFile).pipe(response);
}).listen(4176, '127.0.0.1');
