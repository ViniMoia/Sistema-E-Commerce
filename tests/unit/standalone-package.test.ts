import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { inspectStandalonePackage, stageStandalonePackage } from '../../scripts/lib/standalone-package.mjs';
import { discardIsolatedProject } from '../../scripts/lib/isolated-project.mjs';

const owned: string[] = [];
const links: string[] = [];
afterEach(async () => {
  for (const link of links.splice(0)) await unlink(link);
  for (const directory of owned.splice(0)) await discardIsolatedProject(directory);
});
async function fixture() {
  const project = await mkdtemp(path.join(tmpdir(), 'logic-audit-server-')); owned.push(project);
  const artifact = path.join(project, '.next', 'standalone');
  await mkdir(path.join(artifact, '.next'), { recursive: true });
  await writeFile(path.join(artifact, 'server.js'), '// Entry fixture, not executed');
  await writeFile(path.join(artifact, '.next', 'BUILD_ID'), 'compiled-fixture');
  await mkdir(path.join(project, 'public'), { recursive: true });
  await writeFile(path.join(project, 'public', 'asset.svg'), '<svg/>');
  await mkdir(path.join(project, '.next', 'static'), { recursive: true });
  await writeFile(path.join(project, '.next', 'static', 'bundle.js'), 'console.log("fixture")');
  return { project, artifact };
}

describe('WF-19: independent standalone package and owned cleanup', () => {
  it('stages public/static and preserves the same package after the build source is removed', async () => {
    const { project } = await fixture();
    const first = await stageStandalonePackage(project); owned.push(first.directory);
    const second = await stageStandalonePackage(project); owned.push(second.directory);
    expect(first.manifest).toEqual(second.manifest);
    expect(first.manifest.buildId).toBe('compiled-fixture');
    await discardIsolatedProject(project); owned.splice(owned.indexOf(project), 1);
    expect(await readFile(path.join(first.directory, 'public', 'asset.svg'), 'utf8')).toBe('<svg/>');
    expect(await readFile(path.join(second.directory, '.next', 'static', 'bundle.js'), 'utf8')).toContain('fixture');
    expect(await inspectStandalonePackage(first.directory)).toEqual(first.manifest);
  });
  it('rejects an environment file without logging its content or staging it', async () => {
    const { artifact, project } = await fixture();
    await writeFile(path.join(artifact, '.env.production'), 'SECRET_CANARY');
    await expect(stageStandalonePackage(project)).rejects.toThrow('STANDALONE_ENV_FILE_FORBIDDEN');
  });
  it('rejects a dependency junction instead of silently relying on an external tree', async () => {
    const { artifact, project } = await fixture();
    const target = path.join(project, 'dependencies'); await mkdir(target);
    const link = path.join(artifact, 'node_modules');
    await symlink(target, link, process.platform === 'win32' ? 'junction' : 'dir'); links.push(link);
    await expect(inspectStandalonePackage(artifact)).rejects.toThrow('STANDALONE_DEPENDENCY_LINK_FORBIDDEN');
  });
  it('requires a build identity instead of approving a directory containing only server.js', async () => {
    const { artifact } = await fixture();
    await rm(path.join(artifact, '.next', 'BUILD_ID'));
    await expect(inspectStandalonePackage(artifact)).rejects.toThrow();
  });
});
