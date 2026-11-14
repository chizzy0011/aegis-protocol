import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Account, Keypair, SorobanDataBuilder, TransactionBuilder, rpc, xdr } = require('@stellar/stellar-sdk');
const { AegisClient } = require('@aegis-protocol/sdk');
const {
  AtomicLiquidationGenerator,
  I128_MAX,
  LiquidationError,
  assertLiquidationEligible,
  buildReport,
  computeEligibleAfterTimestamp,
  createKeypairSigner,
  isDefaultedAndEligible,
} = require('../dist/index.js');

const LENDER = Keypair.random();
const BORROWER = Keypair.random();
const OTHER_LENDER = Keypair.random();
const COLLATERAL_TOKEN = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const CASH_TOKEN = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';

function makeAgreement(overrides = {}) {
  return {
    id: 1,
    borrower: BORROWER.publicKey(),
    lender: LENDER.publicKey(),
    collateralToken: COLLATERAL_TOKEN,
    collateralAmount: 1_000_000_000n,
    cashToken: CASH_TOKEN,
    cashBorrowed: 100_000_000n,
    repurchaseAmount: 100_500_000n,
    repoRateBps: 500,
    termSeconds: 3_600,
    haircutBps: 2_000,
    startTimestamp: 1_700_000_000,
    maturityTimestamp: 1_700_003_600,
    status: 'Active',
    ...overrides,
  };
}

function makeSuccessSimulation(minResourceFee = '45000') {
  const sorobanDataXdr = new SorobanDataBuilder()
    .setResources(250_000, 1_024, 512)
    .setResourceFee(minResourceFee)
    .build()
    .toXDR('base64');

  return rpc.parseRawSimulation({
    id: 'sim-1',
    latestLedger: 550_000,
    minResourceFee,
    transactionData: sorobanDataXdr,
    results: [
      {
        auth: [],
        xdr: xdr.ScVal.scvVoid().toXDR('base64'),
      },
    ],
  });
}

test('grace period and boundary eligibility checks match AegisRepoContract::liquidate_default', () => {
  const repo = makeAgreement({ maturityTimestamp: 1_000 });

  // Zero grace period: exact maturity timestamp (now == 1000) is NOT eligible (contract checks `<=`)
  assert.equal(computeEligibleAfterTimestamp(1_000, 0), 1_000);
  assert.equal(isDefaultedAndEligible(repo, 1_000, 0), false);
  assert.equal(isDefaultedAndEligible(repo, 1_001, 0), true);

  // Non-zero grace period (300s): 1300 is still inside grace; 1301 is eligible
  assert.equal(computeEligibleAfterTimestamp(1_000, 300), 1_300);
  assert.equal(isDefaultedAndEligible(repo, 1_300, 300), false);
  assert.equal(isDefaultedAndEligible(repo, 1_301, 300), true);

  assert.throws(
    () => assertLiquidationEligible(repo, 1_300, 300),
    (err) => err instanceof LiquidationError && err.code === 'GRACE_PERIOD_NOT_EXPIRED'
  );

  // Exact I128_MAX collateralAmount succeeds; I128_MAX + 1n and 0n are rejected
  assert.equal(isDefaultedAndEligible(makeAgreement({ collateralAmount: I128_MAX }), 2_000_000_000, 0), true);
  assert.throws(
    () => assertLiquidationEligible(makeAgreement({ collateralAmount: 0n }), 2_000_000_000, 0),
    (err) => err instanceof LiquidationError && err.code === 'INVALID_AGREEMENT'
  );
  assert.throws(
    () => assertLiquidationEligible(makeAgreement({ collateralAmount: I128_MAX + 1n }), 2_000_000_000, 0),
    (err) => err instanceof LiquidationError && err.code === 'INVALID_AGREEMENT'
  );

  // Status, missing lender, and lender mismatch checks
  assert.throws(
    () => assertLiquidationEligible(makeAgreement({ status: 'Closed' }), 2_000_000_000, 0),
    (err) => err instanceof LiquidationError && err.code === 'INVALID_STATUS'
  );
  assert.throws(
    () => assertLiquidationEligible(makeAgreement({ lender: undefined }), 2_000_000_000, 0),
    (err) => err instanceof LiquidationError && err.code === 'MISSING_LENDER'
  );
  assert.throws(
    () =>
      assertLiquidationEligible(
        makeAgreement({ lender: OTHER_LENDER.publicKey() }),
        2_000_000_000,
        0,
        LENDER.publicKey()
      ),
    (err) => err instanceof LiquidationError && err.code === 'UNAUTHORIZED_LENDER'
  );
});

test('AtomicLiquidationGenerator validates configuration bounds strictly', () => {
  const client = new AegisClient('testnet');

  assert.throws(
    () => new AtomicLiquidationGenerator(client, { gracePeriodSeconds: -1, dryRun: true }),
    (err) => err instanceof LiquidationError && err.code === 'INVALID_CONFIG'
  );
  assert.throws(
    () => new AtomicLiquidationGenerator(client, { baseFeeStroops: 50, dryRun: true }),
    (err) => err instanceof LiquidationError && err.code === 'INVALID_CONFIG'
  );
  assert.throws(
    () => new AtomicLiquidationGenerator(client, { baseFeeStroops: 1_000, maxFeeStroops: 500, dryRun: true }),
    (err) => err instanceof LiquidationError && err.code === 'INVALID_CONFIG'
  );
  assert.throws(
    () => new AtomicLiquidationGenerator(client, { dryRun: false }),
    (err) => err instanceof LiquidationError && err.code === 'MISSING_SIGNER'
  );
  assert.throws(
    () =>
      new AtomicLiquidationGenerator(client, {
        signer: LENDER,
        lenderPublicKey: OTHER_LENDER.publicKey(),
      }),
    (err) => err instanceof LiquidationError && err.code === 'INVALID_CONFIG'
  );
});

test('generateEnvelope constructs, simulates, enforces fee cap, and signs atomic liquidation XDR', async (t) => {
  const client = new AegisClient('testnet');
  let seq = 100n;
  t.mock.method(client.server, 'getAccount', async (pub) => new Account(pub, String(seq++)));
  t.mock.method(client.server, 'simulateTransaction', async () => makeSuccessSimulation('45000'));

  const generator = new AtomicLiquidationGenerator(client, {
    gracePeriodSeconds: 60,
    baseFeeStroops: 200,
    maxFeeStroops: 45_200, // Exact boundary: 200 + 45_000 === 45_200 succeeds
    signer: createKeypairSigner(LENDER),
    nowSeconds: () => 1_700_003_661,
  });

  const agreement = makeAgreement({ id: 42, maturityTimestamp: 1_700_003_600 });
  const env = await generator.generateEnvelope(agreement);

  assert.equal(env.repoId, 42);
  assert.equal(env.lender, LENDER.publicKey());
  assert.equal(env.eligibleAfterTimestamp, 1_700_003_660);
  assert.equal(env.stats.baseFeeStroops, 200n);
  assert.equal(env.stats.minResourceFeeStroops, 45_000n);
  assert.equal(env.stats.totalFeeStroops, 45_200n);
  assert.ok(env.signedXdr);
  assert.match(env.txHash, /^[0-9a-f]{64}$/);

  const parsedSigned = TransactionBuilder.fromXDR(env.signedXdr, client.config.networkPassphrase);
  assert.equal(parsedSigned.signatures.length, 1);
  assert.equal(parsedSigned.operations.length, 1);
  assert.equal(parsedSigned.operations[0].type, 'invokeHostFunction');

  // Exceeding maxFeeStroops by 1 stroop is refused before signing
  const tightGenerator = new AtomicLiquidationGenerator(client, {
    gracePeriodSeconds: 60,
    baseFeeStroops: 200,
    maxFeeStroops: 45_199,
    signer: LENDER,
    nowSeconds: () => 1_700_003_661,
  });
  await assert.rejects(
    tightGenerator.generateEnvelope(agreement),
    (err) => err instanceof LiquidationError && err.code === 'FEE_CAP_EXCEEDED'
  );
});

test('generateEnvelope maps Soroban contract simulation errors to typed LiquidationError codes', async (t) => {
  const client = new AegisClient('testnet');
  const repoContract = client.deployment.contracts.repo;
  t.mock.method(client.server, 'getAccount', async (pub) => new Account(pub, '10'));

  const cases = [
    [3, 'UNAUTHORIZED_LENDER'],
    [4, 'AGREEMENT_NOT_FOUND'],
    [5, 'INVALID_STATUS'],
    [6, 'TERM_NOT_EXPIRED'],
  ];

  for (const [contractCode, expectedCode] of cases) {
    client.server.simulateTransaction = async () => ({
      id: 'sim-err',
      latestLedger: 550_001,
      error: `HostError: Error(Contract, #${contractCode})\n0: [Diagnostic Event] contract:${repoContract}, topics:[error, Error(Contract, #${contractCode})], data:"origin"`,
    });

    const generator = new AtomicLiquidationGenerator(client, {
      dryRun: true,
      nowSeconds: () => 1_700_010_000,
    });
    await assert.rejects(
      generator.generateEnvelope(makeAgreement()),
      (err) => err instanceof LiquidationError && err.code === expectedCode
    );
  }
});

test('processDefaultedRepos broadcasts sequentially, skips last-second settled repos, deduplicates, and isolates failures', async (t) => {
  const client = new AegisClient('testnet');
  const repoSettledInRace = makeAgreement({ id: 1, maturityTimestamp: 1_000 });
  const repoValid = makeAgreement({ id: 2, maturityTimestamp: 1_100 });
  const repoOtherLender = makeAgreement({ id: 3, maturityTimestamp: 1_100, lender: OTHER_LENDER.publicKey() });
  const repoBroadcastFail = makeAgreement({ id: 4, maturityTimestamp: 1_200 });
  const repoStillInGrace = makeAgreement({ id: 5, maturityTimestamp: 1_950 });

  let seq = 500n;
  t.mock.method(client.server, 'getAccount', async (pub) => new Account(pub, String(seq++)));
  t.mock.method(client.server, 'simulateTransaction', async () => makeSuccessSimulation('30000'));
  t.mock.method(client, 'listRepos', async () => [
    repoSettledInRace,
    repoValid,
    repoOtherLender,
    repoBroadcastFail,
    repoStillInGrace,
  ]);
  t.mock.method(client, 'getRepo', async (id) => {
    if (id === 1) return { ...repoSettledInRace, status: 'Closed' };
    if (id === 2) return repoValid;
    if (id === 4) return repoBroadcastFail;
    throw new Error(`unexpected id ${id}`);
  });

  const submittedXdrs = [];
  t.mock.method(client, 'submit', async (signedXdr) => {
    submittedXdrs.push(signedXdr);
    if (submittedXdrs.length === 2) {
      throw new Error('tx_bad_seq');
    }
    return { hash: 'b'.repeat(64), ledger: 600_123 };
  });

  const generator = new AtomicLiquidationGenerator(client, {
    gracePeriodSeconds: 100,
    signer: LENDER,
    nowSeconds: () => 2_000, // repo #5 (1950 + 100 = 2050) still inside grace; repo #3 belongs to OTHER_LENDER
  });

  const summary = await generator.processDefaultedRepos();
  assert.equal(summary.eligibleCount, 3); // #1, #2, #4
  assert.equal(summary.results.length, 2);
  assert.equal(summary.results[0].repoId, 1);
  assert.equal(summary.results[0].status, 'skipped');
  assert.match(summary.results[0].skipReason, /Closed/);

  assert.equal(summary.results[1].repoId, 2);
  assert.equal(summary.results[1].status, 'submitted');
  assert.equal(summary.results[1].submission.ledger, 600_123);

  assert.equal(summary.failures.length, 1);
  assert.equal(summary.failures[0].repoId, 4);
  assert.equal(summary.failures[0].code, 'BROADCAST_FAILED');

  // Re-running liquidateOne on already-liquidated repo #2 is idempotently skipped
  const repeat = await generator.liquidateOne(repoValid, 2_000);
  assert.equal(repeat.status, 'skipped');
  assert.match(repeat.skipReason, /already liquidated/);
});

test('buildReport classifies pending, dueSoon, and strictly past-grace liquidatable repos', async (t) => {
  const client = new AegisClient('testnet');
  t.mock.method(client, 'listRepos', async () => [
    makeAgreement({ id: 1, status: 'Pending', lender: undefined, maturityTimestamp: 0 }),
    makeAgreement({ id: 2, status: 'Active', maturityTimestamp: 1_500 }), // exact boundary at now=1200 + grace=300 -> NOT liquidatable yet
    makeAgreement({ id: 3, status: 'Active', maturityTimestamp: 1_199 }), // 1199 + 300 = 1499 < 1500 -> liquidatable
    makeAgreement({ id: 4, status: 'Active', maturityTimestamp: 2_000 }), // matures in 500s -> dueSoon
  ]);

  const report = await buildReport(client, 3_600, 300, 1_500);
  assert.deepEqual(report.pending.map((r) => r.id), [1]);
  assert.deepEqual(report.dueSoon.map((r) => r.id), [4]);
  assert.deepEqual(report.liquidatable.map((r) => r.id), [3]);
});
