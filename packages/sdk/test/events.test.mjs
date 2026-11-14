import test from 'node:test';
import assert from 'node:assert/strict';
import { Address, Contract, Keypair, nativeToScVal } from '@stellar/stellar-sdk';
import {
  AegisClient,
  AegisEventDecodeError,
  AegisEventStream,
  DEPLOYMENTS,
  I128_MAX,
  I128_MIN,
  JUNIOR,
  SENIOR,
  TypedEventEmitter,
  checkedAddI128,
  decodeContractEvent,
  toActivityEvent,
} from '../dist/index.js';

const REPO_CONTRACT =
  DEPLOYMENTS.testnet?.contracts.repo ?? 'CAS6EIMV5R6V6CRCZLVQEM5ML2FIRYBOVPUK5HV5KUAZCKEJSYVUVJ5H';
const CREDIT_CONTRACT =
  DEPLOYMENTS.testnet?.contracts.credit ?? 'CCWPEMHF26ZZAYTRLUL5TFRFOQMOLMPNRADHB4FP2654DPQYDH2OALPE';
const UNKNOWN_CONTRACT = 'CCFMPWEG6WZS5R6CZII7QH3N4AIP24EINM4O6DN74HPF5Z5ASVGTUARK';
const CONTRACTS = { repo: REPO_CONTRACT, credit: CREDIT_CONTRACT };

const sym = (s) => nativeToScVal(s, { type: 'symbol' });
const u64 = (n) => nativeToScVal(BigInt(n), { type: 'u64' });
const u32 = (n) => nativeToScVal(n, { type: 'u32' });
const i128 = (n) => nativeToScVal(BigInt(n), { type: 'i128' });
const addr = (a) => new Address(a).toScVal();
const vec = (items) => nativeToScVal(items);

let seq = 1;
function makeRawEvent({
  id = `0000100000-${String(seq++).padStart(4, '0')}`,
  contractId,
  topic,
  value,
  ledger = 100_000,
  ledgerClosedAt = '2026-11-14T15:00:00Z',
  txHash = 'a'.repeat(64),
  inSuccessfulContractCall = true,
}) {
  return {
    id,
    type: 'contract',
    contractId: contractId ? new Contract(contractId) : undefined,
    topic,
    value,
    ledger,
    ledgerClosedAt,
    transactionIndex: 0,
    operationIndex: 0,
    inSuccessfulContractCall,
    txHash,
  };
}

test('decodeContractEvent decodes all 5 Repo lifecycle events and maps toActivityEvent', () => {
  const borrower = Keypair.random().publicKey();
  const cases = [
    ['proposed', 0, 'Pending'],
    ['funded', 1, 'Active'],
    ['settled', 2, 'Closed'],
    ['liquid', 3, 'Liquidated'],
    ['cancel', 4, 'Cancelled'],
  ];

  for (const [action, statusCode, expectedStatus] of cases) {
    const raw = makeRawEvent({
      contractId: REPO_CONTRACT,
      topic: [sym(action), u64(7)],
      value: vec([addr(borrower), i128(250_000_000n), u32(statusCode)]),
      ledger: 500_010,
    });
    const decoded = decodeContractEvent(raw, CONTRACTS);
    assert.equal(decoded.source, 'repo');
    assert.equal(decoded.action, action);
    assert.equal(decoded.repoId, 7);
    assert.equal(decoded.borrower, borrower);
    assert.equal(decoded.cashBorrowed, 250_000_000n);
    assert.equal(decoded.statusCode, statusCode);
    assert.equal(decoded.status, expectedStatus);

    const activity = toActivityEvent(decoded);
    assert.deepEqual(activity, {
      source: 'repo',
      action,
      id: 7,
      ledger: 500_010,
      closedAt: raw.ledgerClosedAt,
      txHash: raw.txHash,
      account: borrower,
      amount: 250_000_000n,
    });
  }
});

test('decodeContractEvent decodes all 8 Credit lifecycle events including zero-value boundaries', () => {
  const borrower = Keypair.random().publicKey();
  const investor = Keypair.random().publicKey();
  const payer = Keypair.random().publicKey();

  const created = decodeContractEvent(
    makeRawEvent({
      contractId: CREDIT_CONTRACT,
      topic: [sym('created'), u64(1)],
      value: vec([addr(borrower), i128(800_000_000n), i128(200_000_000n)]),
    }),
    CONTRACTS
  );
  assert.equal(created.source, 'credit');
  assert.equal(created.action, 'created');
  assert.equal(created.totalTarget, 1_000_000_000n);
  assert.equal(toActivityEvent(created).amount, 1_000_000_000n);

  const seniorDep = decodeContractEvent(
    makeRawEvent({
      contractId: CREDIT_CONTRACT,
      topic: [sym('deposit'), u64(1)],
      value: vec([addr(investor), u32(SENIOR), i128(800_000_000n)]),
    }),
    CONTRACTS
  );
  assert.equal(seniorDep.action, 'deposit');
  assert.equal(seniorDep.tranche, 0);
  assert.equal(seniorDep.trancheName, 'senior');
  assert.equal(seniorDep.amount, 800_000_000n);

  const juniorDep = decodeContractEvent(
    makeRawEvent({
      contractId: CREDIT_CONTRACT,
      topic: [sym('deposit'), u64(1)],
      value: vec([addr(investor), u32(JUNIOR), i128(200_000_000n)]),
    }),
    CONTRACTS
  );
  assert.equal(juniorDep.action, 'deposit');
  assert.equal(juniorDep.tranche, 1);
  assert.equal(juniorDep.trancheName, 'junior');

  const cancelled = decodeContractEvent(
    makeRawEvent({
      contractId: CREDIT_CONTRACT,
      topic: [sym('cancel'), u64(2)],
      value: addr(borrower),
    }),
    CONTRACTS
  );
  assert.equal(cancelled.action, 'cancel');
  assert.equal(cancelled.borrower, borrower);
  assert.equal(toActivityEvent(cancelled).amount, undefined);

  const refunded = decodeContractEvent(
    makeRawEvent({
      contractId: CREDIT_CONTRACT,
      topic: [sym('refund'), u64(2)],
      value: vec([addr(investor), i128(200_000_000n)]),
    }),
    CONTRACTS
  );
  assert.equal(refunded.action, 'refund');
  assert.equal(refunded.amount, 200_000_000n);

  const drawn = decodeContractEvent(
    makeRawEvent({
      contractId: CREDIT_CONTRACT,
      topic: [sym('drawn'), u64(1)],
      value: vec([addr(borrower), i128(1_000_000_000n)]),
    }),
    CONTRACTS
  );
  assert.equal(drawn.action, 'drawn');
  assert.equal(drawn.amount, 1_000_000_000n);

  // Zero paid boundary when facility is already settled at cap
  const repaidZero = decodeContractEvent(
    makeRawEvent({
      contractId: CREDIT_CONTRACT,
      topic: [sym('repaid'), u64(1)],
      value: vec([addr(payer), i128(0n)]),
    }),
    CONTRACTS
  );
  assert.equal(repaidZero.action, 'repaid');
  assert.equal(repaidZero.amount, 0n);

  // Zero repaidAmount boundary when facility defaults with nothing repaid
  const defaultedZero = decodeContractEvent(
    makeRawEvent({
      contractId: CREDIT_CONTRACT,
      topic: [sym('default'), u64(1)],
      value: i128(0n),
    }),
    CONTRACTS
  );
  assert.equal(defaultedZero.action, 'default');
  assert.equal(defaultedZero.repaidAmount, 0n);
  assert.equal(defaultedZero.facilityStatus, 'Defaulted');

  const claimed = decodeContractEvent(
    makeRawEvent({
      contractId: CREDIT_CONTRACT,
      topic: [sym('claim'), u64(1)],
      value: vec([addr(investor), i128(505_000_000n)]),
    }),
    CONTRACTS
  );
  assert.equal(claimed.action, 'claim');
  assert.equal(claimed.amount, 505_000_000n);
});

test('safe i128 arithmetic and Soroban boundary / error codes', () => {
  const borrower = Keypair.random().publicKey();

  // Exact I128_MAX boundary succeeds
  assert.equal(checkedAddI128(I128_MAX - 10n, 10n), I128_MAX);
  assert.equal(checkedAddI128(I128_MIN, 0n), I128_MIN);

  // Overflow beyond I128_MAX throws AMOUNT_OUT_OF_RANGE
  assert.throws(
    () => checkedAddI128(I128_MAX, 1n),
    (err) => err instanceof AegisEventDecodeError && err.code === 'AMOUNT_OUT_OF_RANGE'
  );

  // Credit created where seniorTarget + juniorTarget overflows i128
  const overflowCreated = makeRawEvent({
    contractId: CREDIT_CONTRACT,
    topic: [sym('created'), u64(9)],
    value: vec([addr(borrower), i128(I128_MAX), i128(1n)]),
  });
  assert.throws(
    () => decodeContractEvent(overflowCreated, CONTRACTS),
    (err) => err instanceof AegisEventDecodeError && err.code === 'AMOUNT_OUT_OF_RANGE'
  );

  // Zero or negative cashBorrowed in repo event is rejected
  const zeroRepoAmount = makeRawEvent({
    contractId: REPO_CONTRACT,
    topic: [sym('proposed'), u64(1)],
    value: vec([addr(borrower), i128(0n), u32(0)]),
  });
  assert.throws(
    () => decodeContractEvent(zeroRepoAmount, CONTRACTS),
    (err) => err instanceof AegisEventDecodeError && err.code === 'AMOUNT_OUT_OF_RANGE'
  );

  const negativeRepoAmount = makeRawEvent({
    contractId: REPO_CONTRACT,
    topic: [sym('proposed'), u64(1)],
    value: vec([addr(borrower), i128(-50n), u32(0)]),
  });
  assert.throws(
    () => decodeContractEvent(negativeRepoAmount, CONTRACTS),
    (err) => err instanceof AegisEventDecodeError && err.code === 'AMOUNT_OUT_OF_RANGE'
  );

  // Invalid id = 0 rejected with INVALID_ID
  const zeroId = makeRawEvent({
    contractId: REPO_CONTRACT,
    topic: [sym('proposed'), u64(0)],
    value: vec([addr(borrower), i128(100n), u32(0)]),
  });
  assert.throws(
    () => decodeContractEvent(zeroId, CONTRACTS),
    (err) => err instanceof AegisEventDecodeError && err.code === 'INVALID_ID'
  );

  // Invalid RepoStatus discriminant = 5 -> INVALID_STATUS
  const badStatus = makeRawEvent({
    contractId: REPO_CONTRACT,
    topic: [sym('proposed'), u64(1)],
    value: vec([addr(borrower), i128(100n), u32(5)]),
  });
  assert.throws(
    () => decodeContractEvent(badStatus, CONTRACTS),
    (err) => err instanceof AegisEventDecodeError && err.code === 'INVALID_STATUS'
  );

  // Invalid Credit tranche = 2 -> INVALID_TRANCHE
  const badTranche = makeRawEvent({
    contractId: CREDIT_CONTRACT,
    topic: [sym('deposit'), u64(1)],
    value: vec([addr(borrower), u32(2), i128(100n)]),
  });
  assert.throws(
    () => decodeContractEvent(badTranche, CONTRACTS),
    (err) => err instanceof AegisEventDecodeError && err.code === 'INVALID_TRANCHE'
  );

  // Unknown contract, missing topics, unknown action, invalid address
  assert.throws(
    () =>
      decodeContractEvent(
        makeRawEvent({ contractId: UNKNOWN_CONTRACT, topic: [sym('proposed'), u64(1)], value: i128(1n) }),
        CONTRACTS
      ),
    (err) => err instanceof AegisEventDecodeError && err.code === 'UNKNOWN_CONTRACT'
  );
  assert.throws(
    () => decodeContractEvent(makeRawEvent({ contractId: REPO_CONTRACT, topic: [sym('proposed')], value: i128(1n) }), CONTRACTS),
    (err) => err instanceof AegisEventDecodeError && err.code === 'MISSING_TOPICS'
  );
  assert.throws(
    () =>
      decodeContractEvent(
        makeRawEvent({ contractId: REPO_CONTRACT, topic: [sym('mystery'), u64(1)], value: i128(1n) }),
        CONTRACTS
      ),
    (err) => err instanceof AegisEventDecodeError && err.code === 'UNKNOWN_ACTION'
  );
  assert.throws(
    () =>
      decodeContractEvent(
        makeRawEvent({
          contractId: CREDIT_CONTRACT,
          topic: [sym('cancel'), u64(1)],
          value: nativeToScVal('not-a-stellar-address', { type: 'string' }),
        }),
        CONTRACTS
      ),
    (err) => err instanceof AegisEventDecodeError && err.code === 'INVALID_ADDRESS'
  );
});

test('TypedEventEmitter supports on, once, off, removeAllListeners, and listenerCount', () => {
  const emitter = new TypedEventEmitter();
  const seen = [];
  const permanent = (x) => seen.push(`on:${x}`);
  emitter.on('ping', permanent);
  emitter.once('ping', (x) => seen.push(`once:${x}`));

  assert.equal(emitter.listenerCount('ping'), 2);
  emitter.emit('ping', 1);
  assert.equal(emitter.listenerCount('ping'), 1);
  emitter.emit('ping', 2);
  assert.deepEqual(seen, ['on:1', 'once:1', 'on:2']);

  emitter.off('ping', permanent);
  assert.equal(emitter.listenerCount('ping'), 0);
  emitter.on('a', () => {});
  emitter.on('b', () => {});
  emitter.removeAllListeners();
  assert.deepEqual(emitter.eventNames(), []);
});

test('AegisEventStream validates constructor options strictly', () => {
  const mockServer = { getEvents: async () => ({ events: [], cursor: '', latestLedger: 1 }), getLatestLedger: async () => ({ sequence: 1 }) };

  assert.throws(
    () => new AegisEventStream({ server: mockServer, contracts: CONTRACTS, startLedger: 10, cursor: 'abc' }),
    /Cannot specify both startLedger and cursor/
  );
  assert.throws(
    () => new AegisEventStream({ server: mockServer, contracts: CONTRACTS, startLedger: 0 }),
    /startLedger must be a positive integer/
  );
  assert.throws(
    () => new AegisEventStream({ server: mockServer, contracts: CONTRACTS, pageLimit: 1001 }),
    /pageLimit must be an integer/
  );
  assert.throws(
    () => new AegisEventStream({ server: mockServer, contracts: CONTRACTS, pollIntervalMs: 0 }),
    /pollIntervalMs must be > 0/
  );
  assert.throws(
    () => new AegisEventStream({ server: mockServer, contracts: {}, sources: ['repo'] }),
    /At least one target contract address/
  );
});

test('AegisEventStream paginates cursor pages, deduplicates, filters failed calls, and emits typed channels', async () => {
  const borrower = Keypair.random().publicKey();
  const investor = Keypair.random().publicKey();

  const ev1 = makeRawEvent({
    id: 'cursor-001',
    contractId: REPO_CONTRACT,
    topic: [sym('proposed'), u64(11)],
    value: vec([addr(borrower), i128(100_000_000n), u32(0)]),
    ledger: 200,
  });
  const evFailed = makeRawEvent({
    id: 'cursor-002-failed',
    contractId: REPO_CONTRACT,
    topic: [sym('funded'), u64(11)],
    value: vec([addr(borrower), i128(100_000_000n), u32(1)]),
    ledger: 201,
    inSuccessfulContractCall: false,
  });
  const ev2 = makeRawEvent({
    id: 'cursor-003',
    contractId: CREDIT_CONTRACT,
    topic: [sym('deposit'), u64(4)],
    value: vec([addr(investor), u32(SENIOR), i128(500_000_000n)]),
    ledger: 202,
  });

  const calls = [];
  const pages = [
    // Page 1 is full (pageLimit = 2), so pollOnce immediately drains Page 2 using cursor
    { events: [ev1, evFailed], cursor: 'cursor-002-failed', latestLedger: 205 },
    // Page 2 is also full (2 events: duplicate ev1 + new ev2), so pollOnce drains Page 3 to confirm end-of-burst
    { events: [ev1, ev2], cursor: 'cursor-003', latestLedger: 205 },
    { events: [], cursor: 'cursor-003', latestLedger: 205 },
    // Next scheduled poll advances ledger to 206
    { events: [], cursor: 'cursor-003', latestLedger: 206 },
  ];

  const server = {
    getLatestLedger: async () => ({ sequence: 200 }),
    getEvents: async (req) => {
      calls.push(req);
      return pages.shift() ?? { events: [], cursor: 'cursor-003', latestLedger: 206 };
    },
  };

  const stream = new AegisEventStream({
    server,
    contracts: CONTRACTS,
    lookbackLedgers: 5,
    pageLimit: 2,
  });

  const allEvents = [];
  const repoProposed = [];
  const creditDeposits = [];
  const activities = [];
  stream.on('event', (e) => allEvents.push(e));
  stream.on('repo:proposed', (e) => repoProposed.push(e));
  stream.on('credit:deposit', (e) => creditDeposits.push(e));
  stream.on('activity', (a) => activities.push(a));

  const batch1 = await stream.pollOnce();
  assert.equal(batch1.length, 2);
  assert.equal(allEvents.length, 2);
  assert.equal(repoProposed.length, 1);
  assert.equal(creditDeposits.length, 1);
  assert.equal(activities.length, 2);
  assert.equal(stream.currentCursor, 'cursor-003');
  assert.equal(stream.lastSyncedLedger, 205);

  // First call used startLedger = 200 - 5 = 195; second call used cursor without startLedger
  assert.equal(calls[0].startLedger, 195);
  assert.equal(calls[0].cursor, undefined);
  assert.equal(calls[1].cursor, 'cursor-002-failed');
  assert.equal(calls[1].startLedger, undefined);

  const batch2 = await stream.pollOnce();
  assert.equal(batch2.length, 0);
  assert.equal(stream.lastSyncedLedger, 206);
});

test('AegisEventStream recovers from stale retention window cursor, isolates malformed events, and reconnects after RPC errors', async () => {
  const borrower = Keypair.random().publicKey();
  const badEvent = makeRawEvent({
    id: 'bad-001',
    contractId: REPO_CONTRACT,
    topic: [sym('unknown_topic'), u64(1)],
    value: i128(1n),
    ledger: 900,
  });
  const goodEvent = makeRawEvent({
    id: 'good-002',
    contractId: REPO_CONTRACT,
    topic: [sym('settled'), u64(1)],
    value: vec([addr(borrower), i128(75_000_000n), u32(2)]),
    ledger: 901,
  });

  let step = 0;
  const server = {
    getLatestLedger: async () => ({ sequence: 900 }),
    getEvents: async (req) => {
      step += 1;
      if (step === 1) {
        assert.equal(req.cursor, 'expired-cursor');
        throw new Error('JSON-RPC error -32600: startLedger must be within the ledger range');
      }
      if (step === 2) {
        assert.equal(req.startLedger, 900);
        return { events: [badEvent, goodEvent], cursor: 'good-002', latestLedger: 901 };
      }
      if (step === 3) {
        throw new Error('503 Service Unavailable');
      }
      return { events: [], cursor: 'good-002', latestLedger: 902 };
    },
  };

  const errors = [];
  const malformed = [];
  const settled = [];
  const reconnected = [];

  const stream = new AegisEventStream({
    server,
    contracts: CONTRACTS,
    cursor: 'expired-cursor',
    pollIntervalMs: 15,
    maxBackoffMs: 40,
  });

  stream.on('error', (e) => errors.push(e.message));
  stream.on('malformedEvent', (e) => malformed.push(e.code));
  stream.on('repo:settled', (e) => settled.push(e.repoId));
  stream.on('reconnected', (info) => reconnected.push(info));

  // Poll 1: recovers automatically from expired cursor -> resets to ledger 900 -> processes goodEvent & reports badEvent
  const first = await stream.pollOnce();
  assert.equal(first.length, 1);
  assert.deepEqual(settled, [1]);
  assert.deepEqual(malformed, ['UNKNOWN_ACTION']);
  assert.equal(errors.length, 1);

  // Poll 2: transient 503 throws and increments failure counter
  await assert.rejects(stream.pollOnce(), /503 Service Unavailable/);

  // Poll 3: succeeds and emits 'reconnected'
  await stream.pollOnce();
  assert.equal(reconnected.length, 1);
  assert.equal(reconnected[0].attempts, 1);
  assert.equal(reconnected[0].latestLedger, 902);
});

test('AegisClient.createEventStream binds client contracts and stops cleanly via AbortController', async () => {
  const client = new AegisClient('testnet');
  const ac = new AbortController();
  let stopped = false;

  const stream = client.createEventStream({
    sources: ['repo'],
    startLedger: 500,
    pollIntervalMs: 50,
    signal: ac.signal,
  });
  stream.on('stop', () => {
    stopped = true;
  });

  // Mock underlying RPC so background start does not hit network
  client.server.getEvents = async () => ({ events: [], cursor: 'c-500', latestLedger: 500 });

  stream.start();
  assert.equal(stream.isRunning, true);
  await new Promise((r) => setTimeout(r, 20));
  ac.abort();
  assert.equal(stream.isRunning, false);
  assert.equal(stopped, true);
});
