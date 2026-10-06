import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export async function copyIsolatedProject({ copyDependencies = false, linkDependencies = true } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'logic-audit-server-'));
  try {
    for (const entry of ['app', 'components', 'lib', 'services', 'types', 'hooks', 'store', 'stores', 'utils', 'public',
      'prisma', 'package.json', 'package-lock.json', 'tsconfig.json', 'next-env.d.ts', 'next.config.js',
      'next.config.ts', 'next.config.mjs', 'postcss.config.js', 'postcss.config.mjs', 'tailwind.config.ts',
      'tailwind.config.js', 'proxy.ts']) {
      try { await fs.cp(path.resolve(entry), path.join(directory, entry), { recursive: true }); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    if (copyDependencies) {
      // Materialize dependencies so file tracing cannot rely on a workspace
      // junction. No install/generate operation mutates the original packages.
      await fs.cp(path.resolve('node_modules'), path.join(directory, 'node_modules'), { recursive: true, dereference: true });
    } else if (linkDependencies) {
      await fs.symlink(path.resolve('node_modules'), path.join(directory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    }
    return directory;
  } catch (error) {
    await discardIsolatedProject(directory);
    throw error;
  }
}

export async function discardIsolatedProject(directory) {
  const resolved = path.resolve(directory);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('logic-audit-server-')) {
    throw new Error('Diretório temporário divergente: descarte bloqueado.');
  }
  const dependencies = path.join(resolved, 'node_modules');
  const stat = await fs.lstat(dependencies).catch(error => { if (error.code !== 'ENOENT') throw error; });
  if (stat?.isSymbolicLink()) await fs.unlink(dependencies);
  await fs.rm(resolved, { recursive: true, force: true });
}
