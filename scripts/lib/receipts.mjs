import fs from 'fs';
import path from 'path';
import { ROOT } from './env.mjs';

const NETWORKS = ['mainnet', 'testnet'];
const runsFile = (network) => path.join(ROOT, 'deployments', `${network}-receipts.json`);

function readRuns(network) {
  const file = runsFile(network);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
}

/**
 * Prepend a run to deployments/<network>-receipts.json (keeping the last 3) and
 * regenerate packages/sdk/src/receipts.ts from every network's file.
 */
export function saveRun(network, account, receipts) {
  const runs = [{ network, ranAt: new Date().toISOString(), account, receipts }, ...readRuns(network)].slice(0, 3);
  fs.writeFileSync(runsFile(network), JSON.stringify(runs, null, 2) + '\n');

  const sdkFile = path.join(ROOT, 'packages', 'sdk', 'src', 'receipts.ts');
  const ts = fs.readFileSync(sdkFile, 'utf8');
  const head = ts.slice(0, ts.indexOf('export const RECEIPTS'));
  const all = NETWORKS.flatMap(readRuns);
  fs.writeFileSync(sdkFile, `${head}export const RECEIPTS: AegisReceiptRun[] = ${JSON.stringify(all, null, 2)};\n`);
}
