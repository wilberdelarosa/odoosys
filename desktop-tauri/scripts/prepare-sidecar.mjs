import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDirectory, '..');
const source = path.resolve(projectRoot, '..', 'ecf-endpoints-service', 'build', 'ecf-service.exe');
const destinationDirectory = path.resolve(projectRoot, 'src-tauri', 'binaries');
const destination = path.resolve(
  destinationDirectory,
  'ecf-service-x86_64-pc-windows-msvc.exe'
);

await fs.mkdir(destinationDirectory, { recursive: true });
await fs.copyFile(source, destination);
console.log(JSON.stringify({ ok: true, source, destination }, null, 2));
