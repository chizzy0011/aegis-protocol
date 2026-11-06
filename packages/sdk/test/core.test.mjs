import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair } from '@stellar/stellar-sdk';
import { AegisClient, DEPLOYMENTS, FACILITY_STATUSES, REPO_STATUSES, TIER_NAMES, fromUnits, toUnits } from '../dist/index.js';

const deployed = Boolean(DEPLOYMENTS.testnet);

test('toUnits / fromUnits round-trip with 7 decimals', () => {
  assert.equal(toUnits('12.5'), 125_000_000n);
  assert.equal(toUnits('0.0000001'), 1n);
  assert.equal(fromUnits(125_000_000n), '12.5');
  assert.throws(() => toUnits('1.12345678'), /decimal places/);
});

test('status and tier tables match the contract enums', () => {
  // Discriminants in contracts/repo and contracts/credit
  assert.deepEqual(REPO_STATUSES, ['Pending', 'Active', 'Closed', 'Liquidated', 'Cancelled']);
  assert.deepEqual(FACILITY_STATUSES, ['Fundraising', 'Active', 'Repaid', 'Defaulted', 'Cancelled']);
  assert.equal(TIER_NAMES[0], 'Not verified');
  assert.equal(TIER_NAMES[2], 'Accredited');
});

test('describeError names the error in the contract where it started', { skip: !deployed && 'not deployed' }, () => {
  const client = new AegisClient('testnet');
  const { repo, credit } = client.deployment.contracts;
  const usdc = client.deployment.assets.cash.contractId;
  const raw = (contract, code) =>
    `HostError: Error(Contract, #${code})\n\nEvent log (newest first):\n` +
    `   0: [Diagnostic Event] contract:${repo}, topics:[error, Error(Contract, #${code})], data:"escalating"\n` +
    `   1: [Diagnostic Event] contract:${contract}, topics:[error, Error(Contract, #${code})], data:"origin"`;

  assert.match(client.describeError(raw(repo, 11)), /^NotEligible \(repo error #11\)/);
  assert.match(client.describeError(raw(credit, 12)), /^NothingToClaim \(credit error #12\)/);
  assert.match(client.describeError(raw(usdc, 10)), /^InsufficientBalance \(token error #10\)/);
});

test('getRepo maps the contract record and its status', { skip: !deployed && 'not deployed' }, async (t) => {
  const client = new AegisClient('testnet');
  const borrower = Keypair.random().publicKey();
  t.mock.method(client, 'simulateRead', async () => ({
    id: 3n,
    borrower,
    lender: null,
    collateral_token: client.deployment.assets.collateral.contractId,
    collateral_amount: 1_000_000_000n,
    cash_token: client.deployment.assets.cash.contractId,
    cash_borrowed: 100_000_000n,
    repurchase_amount: 100_000_570n,
    repo_rate_bps: 500,
    term_seconds: 3600n,
    haircut_bps: 2000,
    start_timestamp: 0n,
    maturity_timestamp: 0n,
    status: 0,
  }));
  const repo = await client.getRepo(3);
  assert.equal(repo.id, 3);
  assert.equal(repo.status, 'Pending');
  assert.equal(repo.lender, undefined);
  assert.equal(repo.repurchaseAmount, 100_000_570n);
  assert.equal(repo.termSeconds, 3600);
});
