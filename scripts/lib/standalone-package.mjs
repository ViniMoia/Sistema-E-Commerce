import { cp, lstat, mkdtemp, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { discardIsolatedProject } from './isolated-project.mjs';

/** Reject secrets and dependency links before considering a standalone package.
 * A successful inventory still needs a real runtime/Prisma/assets regression. */
export async function inspectStandalonePackage(root) {
  const hash = createHash('sha256'); let files = 0; let bytes = 0;
  async function visit(directory, prefix = '') {
    for (const name of (await readdir(directory)).sort()) {
      if (name === '.env' || name.startsWith('.env.')) throw new Error('STANDALONE_ENV_FILE_FORBIDDEN');
      const target = path.join(directory, name), label = prefix + name;
      const stat = await lstat(target);
      if (stat.isSymbolicLink()) throw new Error('STANDALONE_DEPENDENCY_LINK_FORBIDDEN');
      if (stat.isDirectory()) await visit(target, label + '/');
      else if (stat.isFile()) {
        const content = await readFile(target); files++; bytes += content.length;
        hash.update(label + '\0' + content.length + '\0'); hash.update(content);
      } else throw new Error('STANDALONE_SPECIAL_FILE_FORBIDDEN');
    }
  }
  if (!(await lstat(root)).isDirectory() || (await lstat(root)).isSymbolicLink()) throw new Error('STANDALONE_ROOT_INVALID');
  await visit(root);
  const entry = await readFile(path.join(root, 'server.js'), 'utf8');
  const buildId = (await readFile(path.join(root, '.next', 'BUILD_ID'), 'utf8')).trim();
  if (!entry || !buildId) throw new Error('STANDALONE_ENTRYPOINT_INVALID');
  return { sha256: hash.digest('hex'), files, bytes, buildId };
}

export async function stageStandalonePackage(project) {
  const artifact = path.join(project, '.next', 'standalone');
  await inspectStandalonePackage(artifact);
  const directory = await mkdtemp(path.join(tmpdir(), 'logic-audit-server-'));
  try {
    await cp(artifact, directory, { recursive: true });
    // Next does not include these assets in the minimal package automatically.
    await cp(path.join(project, 'public'), path.join(directory, 'public'), { recursive: true });
    await cp(path.join(project, '.next', 'static'), path.join(directory, '.next', 'static'), { recursive: true });
    const manifest = await inspectStandalonePackage(directory);
    return { directory, manifest };
  } catch (error) { await discardIsolatedProject(directory); throw error; }
}
