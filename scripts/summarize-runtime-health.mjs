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

if (!Number.isFinite(minutes) || minutes <= 0) {
  console.error(`Invalid --minutes value: ${minutes}`);
  process.exit(2);
}

if (!fs.existsSync(file)) {
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
const windowed = timestamped.filter((entry) => entry.t >= cutoff);

const patterns = {
  firstFrame: /First render frame completed/i,
  healthPass: /Render health check passed/i,
  healthFail: /Render health check failed/i,
  switchSuccess: /Switched to .* at .*Z/i,
  switchFail: /Failed to switch shader/i,
  gpuValidation: /GPUValidationError|invalid character found|\[object Object\]|CreateShaderModule/i,
};

const summary = {};
for (const [key, pattern] of Object.entries(patterns)) {
  const hits = windowed.filter(({ line }) => pattern.test(line));
  summary[key] = {
    count: hits.length,
    last: hits.length > 0 ? hits[hits.length - 1].line : null,
  };
}

console.log('Runtime health summary');
console.log(`Window: ${new Date(cutoff).toISOString()} .. ${new Date(newest).toISOString()}`);

for (const key of Object.keys(patterns)) {
  const record = summary[key];
  console.log(`- ${key}: ${record.count}`);
  if (record.last) {
    console.log(`  last: ${record.last}`);
  }
}
