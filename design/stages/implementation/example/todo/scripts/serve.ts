import { resolve, sep } from 'node:path';
const directory = resolve(import.meta.dir, '../dist');
const server = Bun.serve({ hostname: '127.0.0.1', port: Number(process.env.PORT ?? 4173), async fetch(request) {
  const url = new URL(request.url);
  const path = resolve(directory, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!path.startsWith(directory + sep)) return new Response('Not found', { status: 404 });
  const file = Bun.file(path);
  return await file.exists() ? new Response(file, { headers: { 'Cache-Control': 'no-store' } }) : new Response('Not found', { status: 404 });
}});
console.log('TodoMVC: ' + server.url);
