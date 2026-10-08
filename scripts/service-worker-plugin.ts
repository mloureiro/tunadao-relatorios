import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';
import { transformWithOxc, type Plugin } from 'vite';

const WORKER_FILE = 'sw.js';

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) =>
      entry.isDirectory()
        ? await listFiles(join(directory, entry.name))
        : [join(directory, entry.name)],
    ),
  );
  return nested.flat();
}

async function versionOf(
  files: readonly string[],
  directory: string,
): Promise<string> {
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file);
    hash.update(await readFile(join(directory, file)));
  }
  return hash.digest('hex').slice(0, 12);
}

export function serviceWorkerPlugin(): Plugin {
  let root = '';
  let outDir = '';
  return {
    name: 'service-worker',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const files = (await listFiles(outDir))
        .map((file) => relative(outDir, file).split(sep).join('/'))
        .filter(
          (file) => file !== WORKER_FILE && !basename(file).startsWith('.'),
        )
        .sort();
      const version = await versionOf(files, outDir);
      const source = await readFile(join(root, 'src/web/sw.ts'), 'utf8');
      const { code } = await transformWithOxc(source, 'sw.ts');
      await writeFile(
        join(outDir, WORKER_FILE),
        code
          .replaceAll('__PRECACHE_FILES__', JSON.stringify(files))
          .replaceAll('__CACHE_VERSION__', JSON.stringify(version)),
      );
    },
  };
}
