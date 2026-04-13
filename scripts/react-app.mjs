import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const argv = process.argv.slice(2);
const command = argv[0];

function getArg(name, fallback) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : fallback;
}

const appRoot = process.cwd();
const require = createRequire(path.join(appRoot, 'package.json'));
const { build, context } = require('esbuild');
const distDir = path.join(appRoot, 'dist');
const assetsDir = path.join(distDir, 'assets');
const publicDir = path.join(appRoot, 'public');
const entryFile = path.join(appRoot, 'src', 'main.tsx');
const indexFile = path.join(appRoot, 'index.html');
const port = Number(getArg('--port', '3000'));
const isDev = command === 'dev';

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.env': 'text/plain; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

function getContentType(filePath) {
  return MIME_TYPES[path.extname(filePath)] || 'application/octet-stream';
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function copyDir(source, target) {
  await ensureDir(target);
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      await copyDir(sourcePath, targetPath);
    } else {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

async function syncStaticFiles() {
  await ensureDir(distDir);
  await fs.copyFile(indexFile, path.join(distDir, 'index.html'));
  try {
    await copyDir(publicDir, distDir);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function buildOptions({ watch = false } = {}) {
  return {
    entryPoints: [entryFile],
    bundle: true,
    outfile: path.join(assetsDir, 'main.js'),
    format: 'esm',
    jsx: 'automatic',
    loader: { '.svg': 'file' },
    minify: !watch,
    platform: 'browser',
    sourcemap: watch,
    target: ['es2020'],
    logLevel: 'info',
  };
}

async function runBuild() {
  await fs.rm(distDir, { recursive: true, force: true });
  await ensureDir(assetsDir);
  await syncStaticFiles();
  await build(buildOptions());
}

async function serveFile(filePath, res) {
  const body = await fs.readFile(filePath);
  res.writeHead(200, { 'Content-Type': getContentType(filePath) });
  res.end(body);
}

async function resolveExistingFile(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() ? filePath : null;
  } catch {
    return null;
  }
}

async function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      const requestedPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const distPath = path.join(distDir, requestedPath);
      const publicPath = path.join(publicDir, requestedPath);

      const devCandidate = isDev ? await resolveExistingFile(publicPath) : null;
      const distCandidate = await resolveExistingFile(distPath);
      const filePath = devCandidate || distCandidate;

      if (filePath) {
        await serveFile(filePath, res);
        return;
      }

      if (req.method === 'GET') {
        await serveFile(path.join(distDir, 'index.html'), res);
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(error instanceof Error ? error.message : 'Server error');
    }
  });

  server.listen(port, () => {
    console.log(`Serving ${appRoot} on http://localhost:${port}`);
  });
}

async function runDev() {
  await fs.rm(distDir, { recursive: true, force: true });
  await ensureDir(assetsDir);
  await syncStaticFiles();

  const ctx = await context(buildOptions({ watch: true }));
  await ctx.watch();
  await startServer();
}

async function runPreview() {
  await startServer();
}

if (!['build', 'dev', 'preview'].includes(command)) {
  console.error('Usage: node scripts/react-app.mjs <build|dev|preview> [--port 3000]');
  process.exit(1);
}

if (command === 'build') {
  await runBuild();
} else if (command === 'dev') {
  await runDev();
} else {
  await runPreview();
}
