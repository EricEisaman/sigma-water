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
  console.error('No timestamped log entries found.');
  process.exit(1);
}

const newest = timestamped[timestamped.length - 1].t;
const now = Date.now();
const stalenessMs = now - newest;
const maxStalenessMs = maxStalenessMinutes * 60 * 1000;
const cutoff = newest - minutes * 60 * 1000;

const windowed = timestamped.filter(({ t }) => t >= cutoff);

const hasFirstFrame = windowed.some(({ line }) => /First render frame completed/i.test(line));
const healthPassCount = windowed.filter(({ line }) => /Render health check passed/i.test(line)).length;
const switchCount = windowed.filter(({ line }) => /Switched to .* at /i.test(line)).length;

console.log(`Render marker window: ${new Date(cutoff).toISOString()} .. ${new Date(newest).toISOString()}`);

if (stalenessMs > maxStalenessMs) {
  console.error(
    `FAIL: newest log line is stale (${Math.round(stalenessMs / 1000)}s old, max ${Math.round(maxStalenessMs / 1000)}s).`
  );
  process.exit(1);
}

if (healthPassCount < 1) {
  console.error('FAIL: missing render-health pass marker in window.');
  process.exit(1);
}

if (!hasFirstFrame && switchCount < 1) {
  console.error('FAIL: missing both first-render and switch-success markers in window.');
  process.exit(1);
}

console.log(
  `PASS: render evidence present (first-frame=${hasFirstFrame}); health passes=${healthPassCount}; switch markers=${switchCount}.`
);
