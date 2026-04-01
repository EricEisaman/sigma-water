import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = '/workspaces/sigma-water';
const coreSrcRoot = path.join(repoRoot, 'packages/sigma-water-core/src');

const disallowedImportPatterns = [
  { regex: /from\s+['"]react['"]|import\s+['"]react['"]/i, message: 'React import found in core package' },
  { regex: /from\s+['"][^'"]*client\//i, message: 'Client import found in core package' },
  { regex: /from\s+['"]@\/|from\s+['"]@\/components|from\s+['"]@\/lib/i, message: 'App alias import found in core package' },
];

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
      continue;
    }

    if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  const files = await collectFiles(coreSrcRoot);
  const failures = [];

  for (const file of files) {
    const content = await readFile(file, 'utf8');
    for (const rule of disallowedImportPatterns) {
      if (rule.regex.test(content)) {
        failures.push(`${rule.message}: ${path.relative(repoRoot, file)}`);
      }
    }
  }

  if (failures.length > 0) {
    console.error('Library boundary check failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('Library boundary check passed.');
}

await main();
