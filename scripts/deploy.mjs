// Deploy and wire the Aegis contracts.
//
//   node scripts/deploy.mjs --network testnet
//   node scripts/deploy.mjs --network mainnet --yes-mainnet   (needs a funded AEGIS_MAINNET_ADMIN_SECRET)
//
// Writes deployments/<network>.json and regenerates packages/sdk/src/deployments.ts.
// Admin secrets live only in the gitignored .env. Resumable: completed steps are
// recorded in deployments/.<network>-progress.json and skipped on a rerun.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Address, Keypair, Operation, TransactionBuilder, nativeToScVal, rpc, scValToNative } from '@stellar/stellar-sdk';
import { NETWORKS } from '../packages/sdk/dist/index.js';
import { ROOT, arg, loadEnv, saveEnv } from './lib/env.mjs';

const network = arg('network', 'testnet');
const config = NETWORKS[network];
if (!config) throw new Error(`Unknown network: ${network}`);
if (network === 'mainnet' && arg('yes-mainnet') !== true) {
  throw new Error('Refusing to deploy to mainnet without --yes-mainnet');
}

loadEnv();
const rpcUrl = (network === 'mainnet' && process.env.AEGIS_MAINNET_RPC_URL) || config.rpcUrl;
const server = new rpc.Server(rpcUrl);
const WASM_DIR = path.join(ROOT, 'target', 'wasm32v1-none', 'release');
const SECRET_VAR = network === 'testnet' ? 'AEGIS_ADMIN_SECRET' : 'AEGIS_MAINNET_ADMIN_SECRET';
const MIN_MAINNET_XLM = 12;
/** Repo market requires Accredited (2); the credit pilot is open (0) so anyone can try it */
const REQUIRED_TIER = { repo: 2, credit: 0 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, label, tries = 6) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const transient = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket|network|503|502|504/i.test(
        `${err.message} ${err.cause?.code ?? ''}`
      );
      if (!transient || i >= tries) throw err;
      console.log(`  (${label}: ${err.cause?.code ?? err.message}, retry ${i}/${tries - 1})`);
      await sleep(2000 * i);
    }
  }
}

const PROGRESS = path.join(ROOT, 'deployments', `.${network}-progress.json`);
const progress = fs.existsSync(PROGRESS) ? JSON.parse(fs.readFileSync(PROGRESS, 'utf8')) : {};
async function step(key, fn) {
  if (progress[key] !== undefined) return progress[key];
  progress[key] = await fn();
  fs.writeFileSync(PROGRESS, JSON.stringify(progress, null, 2));
  return progress[key];
}

async function adminKeypair() {
  if (process.env[SECRET_VAR]) return Keypair.fromSecret(process.env[SECRET_VAR]);
  const kp = Keypair.random();
  saveEnv(SECRET_VAR, kp.secret());
  if (network !== 'testnet') {
    console.log(`Created ${network} admin ${kp.publicKey()} (secret saved to .env as ${SECRET_VAR}).`);
    console.log(`Send at least ${MIN_MAINNET_XLM} XLM to it from your own wallet, then run this command again.`);
    process.exit(2);
  }
  const res = await fetch(`${config.friendbotUrl}?addr=${kp.publicKey()}`);
  if (!res.ok) throw new Error(`Friendbot failed: ${await res.text()}`);
  console.log(`Created testnet admin ${kp.publicKey()} (secret saved to .env)`);
  return kp;
}

async function submit(kp, op, label) {
  const account = await withRetry(() => server.getAccount(kp.publicKey()), label);
  const tx = new TransactionBuilder(account, { fee: '1000000', networkPassphrase: config.networkPassphrase })
    .addOperation(op)
    .setTimeout(120)
    .build();
  const prepared = await withRetry(() => server.prepareTransaction(tx), label);
  prepared.sign(kp);
  // Re-sending the same signed envelope is idempotent (same hash)
  const sent = await withRetry(() => server.sendTransaction(prepared), label);
  if (sent.status === 'ERROR') {
    throw new Error(`${label}: rejected (${sent.errorResult?.result.type ?? 'unknown'})`);
  }
  for (let i = 0; i < 40; i++) {
    await sleep(1500);
    const res = await withRetry(() => server.getTransaction(sent.hash), label);
    if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      console.log(`  ${label}: ${sent.hash}`);
      return { hash: sent.hash, returnValue: res.returnValue ? scValToNative(res.returnValue) : undefined };
    }
    if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`${label}: failed on-chain (${sent.hash})`);
    }
  }
  throw new Error(`${label}: timed out (${sent.hash})`);
}

const invoke = (kp, contractId, method, args, label) =>
  submit(kp, Operation.invokeContractFunction({ contract: contractId, function: method, args }), label);

async function main() {
  const admin = await adminKeypair();
  if (progress.admin && progress.admin !== admin.publicKey()) {
    throw new Error(`${PROGRESS} belongs to admin ${progress.admin}; delete it to start over`);
  }
  await step('admin', async () => admin.publicKey());
  const adminAddr = new Address(admin.publicKey()).toScVal();
  const txs = {};
  const wasmHashes = {};
  const uploaded = {};
  console.log(`Deploying Aegis to ${network} as ${admin.publicKey()}`);

  for (const name of ['compliance', 'repo', 'credit', 'settlement']) {
    const wasm = fs.readFileSync(path.join(WASM_DIR, `aegis_${name}.wasm`));
    wasmHashes[name] = crypto.createHash('sha256').update(wasm).digest('hex');
    txs[`${name}Upload`] = await step(`upload:${wasmHashes[name]}`, async () =>
      (await submit(admin, Operation.uploadContractWasm({ wasm }), `upload ${name}`)).hash
    );
    uploaded[name] = Buffer.from(wasmHashes[name], 'hex');
  }

  const contracts = {};
  for (const name of ['compliance', 'repo', 'credit', 'settlement']) {
    const res = await step(`create:${name}`, async () => {
      const r = await submit(
        admin,
        Operation.createCustomContract({
          address: new Address(admin.publicKey()),
          wasmHash: uploaded[name],
          salt: crypto.randomBytes(32),
        }),
        `create ${name}`
      );
      return { hash: r.hash, contractId: r.returnValue };
    });
    txs[`${name}Create`] = res.hash;
    contracts[name] = res.contractId;
  }

  const call = (key, contractId, method, args) =>
    step(key, async () => (await invoke(admin, contractId, method, args, key)).hash).then((h) => (txs[key] = h));
  const tier = (n) => nativeToScVal(n, { type: 'u32' });
  const complianceAddr = new Address(contracts.compliance).toScVal();

  await call('complianceInit', contracts.compliance, 'initialize', [adminAddr]);
  await call('repoInit', contracts.repo, 'initialize', [adminAddr, complianceAddr, tier(REQUIRED_TIER.repo)]);
  await call('creditInit', contracts.credit, 'initialize', [adminAddr, complianceAddr, tier(REQUIRED_TIER.credit)]);
  await call('settlementInit', contracts.settlement, 'initialize', [adminAddr, new Address(contracts.credit).toScVal()]);

  const deployment = {
    network,
    deployedAt: new Date().toISOString(),
    admin: admin.publicKey(),
    contracts,
    assets: {
      collateral: { code: 'XLM', contractId: config.nativeContractId },
      cash: { code: 'USDC', contractId: config.usdc.contractId },
    },
    requiredTier: REQUIRED_TIER,
    wasmHashes,
    txs,
  };

  fs.writeFileSync(path.join(ROOT, 'deployments', `${network}.json`), JSON.stringify(deployment, null, 2) + '\n');
  writeSdkDeployments(network, deployment);
  fs.unlinkSync(PROGRESS);
  console.log(`\nDone. Repo ${contracts.repo} · Credit ${contracts.credit}`);
}

function writeSdkDeployments(net, deployment) {
  const all = {};
  for (const n of ['testnet', 'mainnet']) {
    const file = path.join(ROOT, 'deployments', `${n}.json`);
    if (n === net) all[n] = deployment;
    else if (fs.existsSync(file)) all[n] = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  const body = `// Generated by scripts/deploy.mjs. Do not edit by hand.
import type { AegisDeployment, AegisNetwork } from './types.js';

export const DEPLOYMENTS: Partial<Record<AegisNetwork, AegisDeployment>> = ${JSON.stringify(all, null, 2)};

export function getDeployment(network: AegisNetwork): AegisDeployment {
  const deployment = DEPLOYMENTS[network];
  if (!deployment) {
    throw new Error(\`Aegis is not deployed on \${network}\`);
  }
  return deployment;
}
`;
  fs.writeFileSync(path.join(ROOT, 'packages', 'sdk', 'src', 'deployments.ts'), body);
}

main().catch((err) => {
  console.error(`\nDeploy failed: ${err.message}`);
  process.exit(1);
});
