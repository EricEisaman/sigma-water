#!/usr/bin/env node
import fs from 'node:fs';

const args = process.argv.slice(2);

function readArg(name, defaultValue) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return defaultValue;
  const next = args[idx + 1];
  if (!next || next.startsWith('--')) return defaultValue;
  return next;
}

const file = readArg('file', '.manus-logs/browserConsole.log');
const minutes = Number(readArg('minutes', '10'));
const maxStalenessMinutes = Number(readArg('max-staleness-minutes', '20'));
const allowMissingFile = readArg('allow-missing-file', 'false') === 'true';

if (!Number.isFinite(minutes) || minutes <= 0) {
  console.error(`Invalid --minutes value: ${minutes}`);
  process.exit(2);
}

if (!Number.isFinite(maxStalenessMinutes) || maxStalenessMinutes <= 0) {
  console.error(`Invalid --max-staleness-minutes value: ${maxStalenessMinutes}`);
  process.exit(2);
}

if (!fs.existsSync(file)) {
  if (allowMissingFile) {
    console.log(`SKIP: log file not found (${file}) and --allow-missing-file=true.`);
    process.exit(0);
  }
  console.error(`Log file not found: ${file}`);
  process.exit(2);
}

const raw = fs.readFileSync(file, 'utf8');
const lines = raw.split(/\r?\n/).filter(Boolean);

const timestamped = [];
for (const line of lines) {
  const match = line.match(/^\[(.*?)\]\s/);
  if (!match) continue;
  const t = Date.parse(match[1]);
  if (!Number.isFinite(t)) continue;
  timestamped.push({ line, t });
}

if (timestamped.length === 0) {
  console.log('No timestamped log entries found.');
  process.exit(0);
}

const newest = timestamped[timestamped.length - 1].t;
const cutoff = newest - minutes * 60 * 1000;
const now = Date.now();
const stalenessMs = now - newest;
const maxStalenessMs = maxStalenessMinutes * 60 * 1000;

const failurePattern = /GPUValidationError|invalid character found|\[object Object\]|CreateShaderModule|Render health check failed|Failed to switch shader|Initialization error/i;
const ignorePattern = /too many warnings/i;

const failures = timestamped.filter(({ line, t }) => {
  if (t < cutoff) return false;
  if (!failurePattern.test(line)) return false;
  if (ignorePattern.test(line)) return false;
  return true;
});

const newestIso = new Date(newest).toISOString();
const cutoffIso = new Date(cutoff).toISOString();

console.log(`Runtime log verification window: ${cutoffIso} .. ${newestIso}`);

if (stalenessMs > maxStalenessMs) {
  console.error(
    `FAIL: newest log line is stale (${Math.round(stalenessMs / 1000)}s old, max ${Math.round(maxStalenessMs / 1000)}s).`
  );
  process.exit(1);
}

if (failures.length === 0) {
  console.log(`PASS: no failure signatures in last ${minutes} minute(s).`);
  process.exit(0);
}

console.error(`FAIL: found ${failures.length} failure signature(s) in last ${minutes} minute(s).`);
for (const entry of failures.slice(-20)) {
  console.error(entry.line);
}
process.exit(1);
