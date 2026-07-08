import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(projectRoot, '..');
const sourceRoot = path.resolve(repoRoot, 'ecf-endpoints-service');
const targetRoot = path.resolve(projectRoot, 'service');

await fs.rm(targetRoot, { recursive: true, force: true });
await copyDirectory(path.join(sourceRoot, 'dist'), path.join(targetRoot, 'dist'));
await copyDirectory(path.join(sourceRoot, 'public'), path.join(targetRoot, 'public'));

console.log(
  JSON.stringify(
    {
      ok: true,
      sourceRoot,
      targetRoot,
    },
    null,
    2
  )
);

async function copyDirectory(source, target) {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
      continue;
    }

    await fs.copyFile(sourcePath, targetPath);
  }
}
