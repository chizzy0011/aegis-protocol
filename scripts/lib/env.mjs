import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ENV_PATH = path.join(ROOT, '.env');

/** Load KEY=VALUE pairs from the gitignored .env into process.env (existing vars win) */
export function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return;
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2];
    }
  }
}

/** Append a secret to the gitignored .env. Never prints the value. */
export function saveEnv(key, value) {
  const prefix = fs.existsSync(ENV_PATH) && !fs.readFileSync(ENV_PATH, 'utf8').endsWith('\n') ? '\n' : '';
  fs.appendFileSync(ENV_PATH, `${prefix}${key}=${value}\n`, { mode: 0o600 });
  process.env[key] = value;
}

export function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}
