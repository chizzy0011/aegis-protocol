import { Contract, StrKey, rpc, scValToNative } from '@stellar/stellar-sdk';
import type { ActivityEvent } from './client.js';
import {
  FACILITY_STATUSES,
  JUNIOR,
  REPO_STATUSES,
  SENIOR,
  type FacilityStatus,
  type RepoStatus,
} from './types.js';

/** Signed 128-bit integer bounds matching Soroban SDK 22 `i128` */
export const I128_MIN = -(1n << 127n);
export const I128_MAX = (1n << 127n) - 1n;

/** Unsigned 64-bit integer upper bound matching Soroban SDK 22 `u64` */
export const U64_MAX = (1n << 64n) - 1n;

export const REPO_EVENT_ACTIONS = ['proposed', 'cancel', 'funded', 'settled', 'liquid'] as const;
export type RepoEventAction = (typeof REPO_EVENT_ACTIONS)[number];

export const CREDIT_EVENT_ACTIONS = [
  'created',
  'deposit',
  'cancel',
  'refund',
  'drawn',
  'repaid',
  'default',
  'claim',
] as const;
export type CreditEventAction = (typeof CREDIT_EVENT_ACTIONS)[number];

export type AegisEventSource = 'repo' | 'credit';

export type AegisEventDecodeErrorCode =
  | 'UNKNOWN_CONTRACT'
  | 'MISSING_TOPICS'
  | 'UNKNOWN_ACTION'
  | 'INVALID_ID'
  | 'INVALID_STATUS'
  | 'INVALID_TRANCHE'
  | 'INVALID_ADDRESS'
  | 'AMOUNT_OUT_OF_RANGE'
  | 'MALFORMED_PAYLOAD';

export class AegisEventDecodeError extends Error {
  constructor(
    public readonly code: AegisEventDecodeErrorCode,
    message: string,
    public readonly eventId?: string
  ) {
    super(message);
    this.name = 'AegisEventDecodeError';
  }
}

export interface AegisEventMetadata {
  eventId: string;
  contractId: string;
  ledger: number;
  closedAt: string;
  txHash: string;
  transactionIndex: number;
  operationIndex: number;
  inSuccessfulContractCall: boolean;
}

/** Mirrors `AegisRepoContract::emit` in `contracts/repo/src/lib.rs` */
export interface RepoContractEvent extends AegisEventMetadata {
  source: 'repo';
  action: RepoEventAction;
  repoId: number;
  borrower: string;
  cashBorrowed: bigint;
  statusCode: number;
  status: RepoStatus;
}

export interface CreditCreatedEvent extends AegisEventMetadata {
  source: 'credit';
  action: 'created';
  facilityId: number;
  borrower: string;
  seniorTarget: bigint;
  juniorTarget: bigint;
  totalTarget: bigint;
}

export interface CreditDepositEvent extends AegisEventMetadata {
  source: 'credit';
  action: 'deposit';
  facilityId: number;
  investor: string;
  tranche: typeof SENIOR | typeof JUNIOR;
  trancheName: 'senior' | 'junior';
  amount: bigint;
}

export interface CreditCancelEvent extends AegisEventMetadata {
  source: 'credit';
  action: 'cancel';
  facilityId: number;
  borrower: string;
}

export interface CreditRefundEvent extends AegisEventMetadata {
  source: 'credit';
  action: 'refund';
  facilityId: number;
  investor: string;
  amount: bigint;
}

export interface CreditDrawnEvent extends AegisEventMetadata {
  source: 'credit';
  action: 'drawn';
  facilityId: number;
  borrower: string;
  amount: bigint;
}

export interface CreditRepaidEvent extends AegisEventMetadata {
  source: 'credit';
  action: 'repaid';
  facilityId: number;
  payer: string;
  amount: bigint;
}

export interface CreditDefaultEvent extends AegisEventMetadata {
  source: 'credit';
  action: 'default';
  facilityId: number;
  repaidAmount: bigint;
  facilityStatus: Extract<FacilityStatus, 'Defaulted'>;
}

export interface CreditClaimEvent extends AegisEventMetadata {
  source: 'credit';
  action: 'claim';
  facilityId: number;
  investor: string;
  amount: bigint;
}

export type CreditContractEvent =
  | CreditCreatedEvent
  | CreditDepositEvent
  | CreditCancelEvent
  | CreditRefundEvent
  | CreditDrawnEvent
  | CreditRepaidEvent
  | CreditDefaultEvent
  | CreditClaimEvent;

export type AegisContractEvent = RepoContractEvent | CreditContractEvent;

export interface LedgerCheckpoint {
  latestLedger: number;
  cursor?: string;
  startLedger?: number;
}

export interface ReconnectInfo {
  attempts: number;
  latestLedger: number;
}

export interface StreamStartInfo {
  startLedger?: number;
  cursor?: string;
}

export type AegisEventMap = {
  event: [event: AegisContractEvent];
  activity: [activity: ActivityEvent];
  repo: [event: RepoContractEvent];
  'repo:proposed': [event: RepoContractEvent];
  'repo:cancel': [event: RepoContractEvent];
  'repo:funded': [event: RepoContractEvent];
  'repo:settled': [event: RepoContractEvent];
  'repo:liquid': [event: RepoContractEvent];
  credit: [event: CreditContractEvent];
  'credit:created': [event: CreditCreatedEvent];
  'credit:deposit': [event: CreditDepositEvent];
  'credit:cancel': [event: CreditCancelEvent];
  'credit:refund': [event: CreditRefundEvent];
  'credit:drawn': [event: CreditDrawnEvent];
  'credit:repaid': [event: CreditRepaidEvent];
  'credit:default': [event: CreditDefaultEvent];
  'credit:claim': [event: CreditClaimEvent];
  ledger: [checkpoint: LedgerCheckpoint];
  reconnected: [info: ReconnectInfo];
  start: [info: StreamStartInfo];
  stop: [];
  malformedEvent: [error: AegisEventDecodeError, rawEvent: rpc.Api.EventResponse];
  error: [error: Error];
};

/**
 * Runtime-agnostic typed EventEmitter supporting both Node.js daemons
 * (`@aegis-protocol/repo-watcher`) and browser bundles (`@aegis-protocol/web`).
 */
export class TypedEventEmitter<Events extends Record<string, unknown[]> = Record<string, unknown[]>> {
  private readonly handlers = new Map<keyof Events, Set<(...args: unknown[]) => void>>();

  on<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): this {
    let bucket = this.handlers.get(event);
    if (!bucket) {
      bucket = new Set();
      this.handlers.set(event, bucket);
    }
    bucket.add(listener as (...args: unknown[]) => void);
    return this;
  }

  addListener<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): this {
    return this.on(event, listener);
  }

  once<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): this {
    const wrapper = (...args: Events[K]) => {
      this.off(event, wrapper);
      listener(...args);
    };
    return this.on(event, wrapper);
  }

  off<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): this {
    const bucket = this.handlers.get(event);
    if (bucket) {
      bucket.delete(listener as (...args: unknown[]) => void);
      if (bucket.size === 0) {
        this.handlers.delete(event);
      }
    }
    return this;
  }

  removeListener<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): this {
    return this.off(event, listener);
  }

  removeAllListeners<K extends keyof Events>(event?: K): this {
    if (event === undefined) {
      this.handlers.clear();
    } else {
      this.handlers.delete(event);
    }
    return this;
  }

  listenerCount<K extends keyof Events>(event: K): number {
    return this.handlers.get(event)?.size ?? 0;
  }

  listeners<K extends keyof Events>(event: K): Array<(...args: Events[K]) => void> {
    const bucket = this.handlers.get(event);
    return bucket ? ([...bucket] as Array<(...args: Events[K]) => void>) : [];
  }

  eventNames(): Array<keyof Events> {
    return [...this.handlers.keys()];
  }

  emit<K extends keyof Events>(event: K, ...args: Events[K]): boolean {
    const bucket = this.handlers.get(event);
    if (!bucket || bucket.size === 0) {
      return false;
    }
    for (const fn of [...bucket]) {
      fn(...args);
    }
    return true;
  }
}

export interface AegisContractAddresses {
  repo?: string;
  credit?: string;
}

export type RpcEventsProvider = Pick<rpc.Server, 'getEvents' | 'getLatestLedger'>;

export interface AegisEventStreamOptions {
  server: RpcEventsProvider;
  contracts: AegisContractAddresses;
  /** Restrict subscription to specific protocol contracts (defaults to all configured contracts) */
  sources?: AegisEventSource[];
  /** Explicit starting ledger sequence (>= 1). Mutually exclusive with `cursor`. */
  startLedger?: number;
  /** Resume from a previously persisted Soroban RPC event cursor. Mutually exclusive with `startLedger`. */
  cursor?: string;
  /** Number of closed ledgers to look back when neither `startLedger` nor `cursor` is provided (default: 0) */
  lookbackLedgers?: number;
  /** Polling interval in milliseconds while streaming (default: 2000) */
  pollIntervalMs?: number;
  /** Maximum events requested per `getEvents` RPC call, 1..1000 (default: 100) */
  pageLimit?: number;
  /** Maximum cursor pages drained inside a single poll cycle (default: 10) */
  maxPagesPerPoll?: number;
  /** Maximum retry backoff delay in milliseconds on transient RPC errors (default: 30000) */
  maxBackoffMs?: number;
  /** Bounded FIFO deduplication window size (default: 2048) */
  dedupeCacheSize?: number;
  /** Emit events from reverted/failed contract calls if present (default: false) */
  includeFailedCalls?: boolean;
  /** Automatically recover to `latestLedger` when RPC reports an expired cursor/ledger range (default: true) */
  autoResetOnRetentionOutOfBounds?: boolean;
  /** Optional `AbortSignal` that stops the stream when aborted */
  signal?: AbortSignal;
}

export type AegisClientEventStreamOptions = Omit<AegisEventStreamOptions, 'server' | 'contracts'> & {
  contracts?: AegisContractAddresses;
};

/** Safe checked addition within Soroban `i128` bounds */
export function checkedAddI128(a: bigint, b: bigint, eventId?: string): bigint {
  if (a < I128_MIN || a > I128_MAX || b < I128_MIN || b > I128_MAX) {
    throw new AegisEventDecodeError(
      'AMOUNT_OUT_OF_RANGE',
      `Operand outside Soroban i128 bounds: ${a.toString()}, ${b.toString()}`,
      eventId
    );
  }
  const sum = a + b;
  if (sum < I128_MIN || sum > I128_MAX) {
    throw new AegisEventDecodeError(
      'AMOUNT_OUT_OF_RANGE',
      `i128 addition overflow: ${a.toString()} + ${b.toString()}`,
      eventId
    );
  }
  return sum;
}

function parseEntityId(raw: unknown, eventId?: string): number {
  let asBigInt: bigint;
  try {
    if (typeof raw === 'bigint') {
      asBigInt = raw;
    } else if (typeof raw === 'number' && Number.isInteger(raw)) {
      asBigInt = BigInt(raw);
    } else {
      throw new Error('non-integer id');
    }
  } catch {
    throw new AegisEventDecodeError('INVALID_ID', `Expected integer u64 id, got ${String(raw)}`, eventId);
  }
  if (asBigInt < 1n || asBigInt > U64_MAX || asBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new AegisEventDecodeError(
      'INVALID_ID',
      `Agreement or facility id out of safe u64 range: ${asBigInt.toString()}`,
      eventId
    );
  }
  return Number(asBigInt);
}

function parseNonNegativeI128(raw: unknown, field: string, allowZero: boolean, eventId?: string): bigint {
  let value: bigint;
  try {
    if (typeof raw === 'bigint') {
      value = raw;
    } else if (typeof raw === 'number' && Number.isInteger(raw)) {
      value = BigInt(raw);
    } else if (typeof raw === 'string' && /^-?\d+$/.test(raw)) {
      value = BigInt(raw);
    } else {
      throw new Error('non-integer amount');
    }
  } catch {
    throw new AegisEventDecodeError(
      'MALFORMED_PAYLOAD',
      `Expected integer i128 for ${field}, got ${String(raw)}`,
      eventId
    );
  }
  const minAllowed = allowZero ? 0n : 1n;
  if (value < minAllowed || value > I128_MAX) {
    throw new AegisEventDecodeError(
      'AMOUNT_OUT_OF_RANGE',
      `Field ${field} (${value.toString()}) is outside allowed i128 range [${minAllowed.toString()}, I128_MAX]`,
      eventId
    );
  }
  return value;
}

function parseAddress(raw: unknown, field: string, eventId?: string): string {
  if (typeof raw !== 'string' || (!StrKey.isValidEd25519PublicKey(raw) && !StrKey.isValidContract(raw))) {
    throw new AegisEventDecodeError(
      'INVALID_ADDRESS',
      `Invalid Stellar address for ${field}: ${String(raw)}`,
      eventId
    );
  }
  return raw;
}

function extractContractId(raw: rpc.Api.EventResponse): string | undefined {
  const cid = raw.contractId as unknown;
  if (!cid) return undefined;
  if (typeof cid === 'string') return cid;
  if (cid instanceof Contract || typeof (cid as { contractId?: unknown }).contractId === 'function') {
    return (cid as { contractId(): string }).contractId();
  }
  return undefined;
}

function isRepoAction(action: string): action is RepoEventAction {
  return (REPO_EVENT_ACTIONS as readonly string[]).includes(action);
}

function isCreditAction(action: string): action is CreditEventAction {
  return (CREDIT_EVENT_ACTIONS as readonly string[]).includes(action);
}

/**
 * Decode a raw Soroban RPC `EventResponse` into a strictly typed `AegisContractEvent`.
 */
export function decodeContractEvent(
  raw: rpc.Api.EventResponse,
  contracts: AegisContractAddresses
): AegisContractEvent {
  const eventId = raw.id;
  const contractId = extractContractId(raw);
  if (!contractId) {
    throw new AegisEventDecodeError('UNKNOWN_CONTRACT', 'Event carries no contractId', eventId);
  }

  const source: AegisEventSource | undefined =
    contracts.repo && contractId === contracts.repo
      ? 'repo'
      : contracts.credit && contractId === contracts.credit
        ? 'credit'
        : undefined;

  if (!source) {
    throw new AegisEventDecodeError(
      'UNKNOWN_CONTRACT',
      `Event from unrecognized contract: ${contractId}`,
      eventId
    );
  }

  if (!Array.isArray(raw.topic) || raw.topic.length < 2) {
    throw new AegisEventDecodeError(
      'MISSING_TOPICS',
      `Expected at least 2 event topics (action, id), got ${raw.topic?.length ?? 0}`,
      eventId
    );
  }

  let rawAction: unknown;
  let rawId: unknown;
  let data: unknown;
  try {
    rawAction = scValToNative(raw.topic[0]);
    rawId = scValToNative(raw.topic[1]);
    data = scValToNative(raw.value);
  } catch (err) {
    throw new AegisEventDecodeError(
      'MALFORMED_PAYLOAD',
      `Failed to decode ScVal topics or value: ${err instanceof Error ? err.message : String(err)}`,
      eventId
    );
  }

  const action = String(rawAction);
  const entityId = parseEntityId(rawId, eventId);
  const metadata: AegisEventMetadata = {
    eventId,
    contractId,
    ledger: raw.ledger,
    closedAt: raw.ledgerClosedAt,
    txHash: raw.txHash,
    transactionIndex: raw.transactionIndex ?? 0,
    operationIndex: raw.operationIndex ?? 0,
    inSuccessfulContractCall: raw.inSuccessfulContractCall ?? true,
  };

  if (source === 'repo') {
    if (!isRepoAction(action)) {
      throw new AegisEventDecodeError('UNKNOWN_ACTION', `Unknown repo event action: ${action}`, eventId);
    }
    if (!Array.isArray(data) || data.length < 3) {
      throw new AegisEventDecodeError(
        'MALFORMED_PAYLOAD',
        `Repo event '${action}' expected [borrower, cashBorrowed, status] tuple`,
        eventId
      );
    }
    const borrower = parseAddress(data[0], 'borrower', eventId);
    const cashBorrowed = parseNonNegativeI128(data[1], 'cashBorrowed', false, eventId);
    const rawStatus = typeof data[2] === 'bigint' ? Number(data[2]) : Number(data[2]);
    if (!Number.isInteger(rawStatus) || rawStatus < 0 || rawStatus >= REPO_STATUSES.length) {
      throw new AegisEventDecodeError(
        'INVALID_STATUS',
        `Invalid RepoStatus discriminant: ${String(data[2])}`,
        eventId
      );
    }
    return {
      ...metadata,
      source: 'repo',
      action,
      repoId: entityId,
      borrower,
      cashBorrowed,
      statusCode: rawStatus,
      status: REPO_STATUSES[rawStatus],
    };
  }

  if (!isCreditAction(action)) {
    throw new AegisEventDecodeError('UNKNOWN_ACTION', `Unknown credit event action: ${action}`, eventId);
  }

  switch (action) {
    case 'created': {
      if (!Array.isArray(data) || data.length < 3) {
        throw new AegisEventDecodeError(
          'MALFORMED_PAYLOAD',
          "Credit 'created' expected [borrower, seniorTarget, juniorTarget] tuple",
          eventId
        );
      }
      const borrower = parseAddress(data[0], 'borrower', eventId);
      const seniorTarget = parseNonNegativeI128(data[1], 'seniorTarget', false, eventId);
      const juniorTarget = parseNonNegativeI128(data[2], 'juniorTarget', false, eventId);
      const totalTarget = checkedAddI128(seniorTarget, juniorTarget, eventId);
      return {
        ...metadata,
        source: 'credit',
        action: 'created',
        facilityId: entityId,
        borrower,
        seniorTarget,
        juniorTarget,
        totalTarget,
      };
    }
    case 'deposit': {
      if (!Array.isArray(data) || data.length < 3) {
        throw new AegisEventDecodeError(
          'MALFORMED_PAYLOAD',
          "Credit 'deposit' expected [investor, tranche, amount] tuple",
          eventId
        );
      }
      const investor = parseAddress(data[0], 'investor', eventId);
      const rawTranche = typeof data[1] === 'bigint' ? Number(data[1]) : Number(data[1]);
      if (rawTranche !== SENIOR && rawTranche !== JUNIOR) {
        throw new AegisEventDecodeError(
          'INVALID_TRANCHE',
          `Invalid credit tranche discriminant: ${String(data[1])}`,
          eventId
        );
      }
      const amount = parseNonNegativeI128(data[2], 'amount', false, eventId);
      return {
        ...metadata,
        source: 'credit',
        action: 'deposit',
        facilityId: entityId,
        investor,
        tranche: rawTranche,
        trancheName: rawTranche === SENIOR ? 'senior' : 'junior',
        amount,
      };
    }
    case 'cancel': {
      const borrower = parseAddress(data, 'borrower', eventId);
      return {
        ...metadata,
        source: 'credit',
        action: 'cancel',
        facilityId: entityId,
        borrower,
      };
    }
    case 'refund': {
      if (!Array.isArray(data) || data.length < 2) {
        throw new AegisEventDecodeError(
          'MALFORMED_PAYLOAD',
          "Credit 'refund' expected [investor, total] tuple",
          eventId
        );
      }
      const investor = parseAddress(data[0], 'investor', eventId);
      const amount = parseNonNegativeI128(data[1], 'amount', false, eventId);
      return {
        ...metadata,
        source: 'credit',
        action: 'refund',
        facilityId: entityId,
        investor,
        amount,
      };
    }
    case 'drawn': {
      if (!Array.isArray(data) || data.length < 2) {
        throw new AegisEventDecodeError(
          'MALFORMED_PAYLOAD',
          "Credit 'drawn' expected [borrower, total] tuple",
          eventId
        );
      }
      const borrower = parseAddress(data[0], 'borrower', eventId);
      const amount = parseNonNegativeI128(data[1], 'amount', false, eventId);
      return {
        ...metadata,
        source: 'credit',
        action: 'drawn',
        facilityId: entityId,
        borrower,
        amount,
      };
    }
    case 'repaid': {
      if (!Array.isArray(data) || data.length < 2) {
        throw new AegisEventDecodeError(
          'MALFORMED_PAYLOAD',
          "Credit 'repaid' expected [payer, paid] tuple",
          eventId
        );
      }
      const payer = parseAddress(data[0], 'payer', eventId);
      // Over-repayment when 0 remains owed can cap `paid` at 0 on-chain, so allow zero
      const amount = parseNonNegativeI128(data[1], 'amount', true, eventId);
      return {
        ...metadata,
        source: 'credit',
        action: 'repaid',
        facilityId: entityId,
        payer,
        amount,
      };
    }
    case 'default': {
      const repaidAmount = parseNonNegativeI128(data, 'repaidAmount', true, eventId);
      return {
        ...metadata,
        source: 'credit',
        action: 'default',
        facilityId: entityId,
        repaidAmount,
        facilityStatus: FACILITY_STATUSES[3] as 'Defaulted',
      };
    }
    case 'claim': {
      if (!Array.isArray(data) || data.length < 2) {
        throw new AegisEventDecodeError(
          'MALFORMED_PAYLOAD',
          "Credit 'claim' expected [investor, claimable] tuple",
          eventId
        );
      }
      const investor = parseAddress(data[0], 'investor', eventId);
      const amount = parseNonNegativeI128(data[1], 'amount', false, eventId);
      return {
        ...metadata,
        source: 'credit',
        action: 'claim',
        facilityId: entityId,
        investor,
        amount,
      };
    }
  }
}

/** Convert a typed `AegisContractEvent` into the summary `ActivityEvent` shape */
export function toActivityEvent(event: AegisContractEvent): ActivityEvent {
  if (event.source === 'repo') {
    return {
      source: 'repo',
      action: event.action,
      id: event.repoId,
      ledger: event.ledger,
      closedAt: event.closedAt,
      txHash: event.txHash,
      account: event.borrower,
      amount: event.cashBorrowed,
    };
  }

  const base = {
    source: 'credit' as const,
    action: event.action,
    id: event.facilityId,
    ledger: event.ledger,
    closedAt: event.closedAt,
    txHash: event.txHash,
  };

  switch (event.action) {
    case 'created':
      return { ...base, account: event.borrower, amount: event.totalTarget };
    case 'deposit':
      return { ...base, account: event.investor, amount: event.amount };
    case 'cancel':
      return { ...base, account: event.borrower };
    case 'refund':
      return { ...base, account: event.investor, amount: event.amount };
    case 'drawn':
      return { ...base, account: event.borrower, amount: event.amount };
    case 'repaid':
      return { ...base, account: event.payer, amount: event.amount };
    case 'default':
      return { ...base, amount: event.repaidAmount };
    case 'claim':
      return { ...base, account: event.investor, amount: event.amount };
  }
}

function isRetentionRangeError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /startLedger.*ledger range|outside.*retention|cursor.*invalid|cursor.*expired|ledger range/i.test(msg) ||
    /-32600/.test(msg)
  );
}

/**
 * Real-time Soroban RPC event stream listener for Aegis Repo and Credit contracts.
 * Polls `rpc.Server.getEvents` with cursor continuation, deduplication, retention recovery,
 * and typed `EventEmitter` notifications.
 */
export class AegisEventStream extends TypedEventEmitter<AegisEventMap> {
  private readonly server: RpcEventsProvider;
  private readonly contracts: AegisContractAddresses;
  private readonly contractIds: string[];
  private readonly lookbackLedgers: number;
  private readonly pollIntervalMs: number;
  private readonly pageLimit: number;
  private readonly maxPagesPerPoll: number;
  private readonly maxBackoffMs: number;
  private readonly dedupeCacheSize: number;
  private readonly includeFailedCalls: boolean;
  private readonly autoResetOnRetentionOutOfBounds: boolean;
  private readonly abortSignal?: AbortSignal;
  private readonly onAbortHandler = () => this.stop();

  private cursor: string | undefined;
  private nextStartLedger: number | undefined;
  private latestSyncedLedger: number | undefined;
  private running = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inflightPoll: Promise<AegisContractEvent[]> | undefined;
  private consecutiveFailures = 0;
  private readonly seenIds = new Set<string>();

  constructor(options: AegisEventStreamOptions) {
    super();
    if (options.startLedger !== undefined && options.cursor !== undefined) {
      throw new Error('Cannot specify both startLedger and cursor in AegisEventStreamOptions');
    }
    if (
      options.startLedger !== undefined &&
      (!Number.isInteger(options.startLedger) || options.startLedger < 1)
    ) {
      throw new Error(`startLedger must be a positive integer, got ${options.startLedger}`);
    }
    if (options.cursor !== undefined && options.cursor.trim() === '') {
      throw new Error('cursor must be a non-empty string when provided');
    }

    const lookback = options.lookbackLedgers ?? 0;
    if (!Number.isInteger(lookback) || lookback < 0) {
      throw new Error(`lookbackLedgers must be a non-negative integer, got ${lookback}`);
    }

    const pollIntervalMs = options.pollIntervalMs ?? 2_000;
    if (!Number.isFinite(pollIntervalMs) || pollIntervalMs <= 0) {
      throw new Error(`pollIntervalMs must be > 0, got ${pollIntervalMs}`);
    }

    const pageLimit = options.pageLimit ?? 100;
    if (!Number.isInteger(pageLimit) || pageLimit < 1 || pageLimit > 1_000) {
      throw new Error(`pageLimit must be an integer in [1, 1000], got ${pageLimit}`);
    }

    const maxPagesPerPoll = options.maxPagesPerPoll ?? 10;
    if (!Number.isInteger(maxPagesPerPoll) || maxPagesPerPoll < 1) {
      throw new Error(`maxPagesPerPoll must be >= 1, got ${maxPagesPerPoll}`);
    }

    const maxBackoffMs = options.maxBackoffMs ?? 30_000;
    if (!Number.isFinite(maxBackoffMs) || maxBackoffMs < pollIntervalMs) {
      throw new Error(`maxBackoffMs (${maxBackoffMs}) must be >= pollIntervalMs (${pollIntervalMs})`);
    }

    const dedupeCacheSize = options.dedupeCacheSize ?? 2_048;
    if (!Number.isInteger(dedupeCacheSize) || dedupeCacheSize < 1) {
      throw new Error(`dedupeCacheSize must be >= 1, got ${dedupeCacheSize}`);
    }

    const sources = options.sources ?? (['repo', 'credit'] as AegisEventSource[]);
    if (sources.length === 0) {
      throw new Error('sources must include at least one contract source ("repo" or "credit")');
    }

    const selectedContracts: AegisContractAddresses = {};
    const ids: string[] = [];
    for (const source of sources) {
      const id = options.contracts[source];
      if (id) {
        selectedContracts[source] = id;
        if (!ids.includes(id)) ids.push(id);
      }
    }
    if (ids.length === 0) {
      throw new Error('At least one target contract address (repo or credit) must be configured');
    }

    this.server = options.server;
    this.contracts = selectedContracts;
    this.contractIds = ids;
    this.cursor = options.cursor;
    this.nextStartLedger = options.startLedger;
    this.lookbackLedgers = lookback;
    this.pollIntervalMs = pollIntervalMs;
    this.pageLimit = pageLimit;
    this.maxPagesPerPoll = maxPagesPerPoll;
    this.maxBackoffMs = maxBackoffMs;
    this.dedupeCacheSize = dedupeCacheSize;
    this.includeFailedCalls = options.includeFailedCalls ?? false;
    this.autoResetOnRetentionOutOfBounds = options.autoResetOnRetentionOutOfBounds ?? true;
    this.abortSignal = options.signal;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get currentCursor(): string | undefined {
    return this.cursor;
  }

  get lastSyncedLedger(): number | undefined {
    return this.latestSyncedLedger;
  }

  /** Start background polling of Soroban RPC events */
  start(): this {
    if (this.running) return this;
    if (this.abortSignal?.aborted) {
      return this;
    }
    this.running = true;
    this.abortSignal?.addEventListener('abort', this.onAbortHandler, { once: true });
    this.emit('start', { startLedger: this.nextStartLedger, cursor: this.cursor });
    this.scheduleNext(0);
    return this;
  }

  /** Stop background polling and cancel any scheduled timer */
  stop(): this {
    if (!this.running) return this;
    this.running = false;
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.abortSignal?.removeEventListener('abort', this.onAbortHandler);
    this.emit('stop');
    return this;
  }

  /**
   * Execute a single poll cycle against Soroban RPC, draining up to `maxPagesPerPoll`
   * pages and emitting typed notifications for each newly observed contract event.
   */
  pollOnce(): Promise<AegisContractEvent[]> {
    if (this.inflightPoll) {
      return this.inflightPoll;
    }
    const task = this.executePollCycle().finally(() => {
      this.inflightPoll = undefined;
    });
    this.inflightPoll = task;
    return task;
  }

  private scheduleNext(delayMs: number): void {
    if (!this.running) return;
    this.timer = setTimeout(async () => {
      this.timer = undefined;
      if (!this.running) return;
      try {
        await this.pollOnce();
        this.scheduleNext(this.pollIntervalMs);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.emit('error', error);
        const backoff = Math.min(
          this.maxBackoffMs,
          this.pollIntervalMs * 2 ** Math.min(this.consecutiveFailures - 1, 10)
        );
        this.scheduleNext(backoff);
      }
    }, delayMs);
  }

  private rememberEventKey(key: string): boolean {
    if (this.seenIds.has(key)) {
      return false;
    }
    if (this.seenIds.size >= this.dedupeCacheSize) {
      const oldest = this.seenIds.values().next().value;
      if (oldest !== undefined) {
        this.seenIds.delete(oldest);
      }
    }
    this.seenIds.add(key);
    return true;
  }

  private dispatchDecodedEvent(decoded: AegisContractEvent): void {
    this.safeEmit('event', decoded);
    this.safeEmit('activity', toActivityEvent(decoded));

    if (decoded.source === 'repo') {
      this.safeEmit('repo', decoded);
      this.safeEmit(`repo:${decoded.action}`, decoded);
      return;
    }

    this.safeEmit('credit', decoded);
    switch (decoded.action) {
      case 'created':
        this.safeEmit('credit:created', decoded);
        break;
      case 'deposit':
        this.safeEmit('credit:deposit', decoded);
        break;
      case 'cancel':
        this.safeEmit('credit:cancel', decoded);
        break;
      case 'refund':
        this.safeEmit('credit:refund', decoded);
        break;
      case 'drawn':
        this.safeEmit('credit:drawn', decoded);
        break;
      case 'repaid':
        this.safeEmit('credit:repaid', decoded);
        break;
      case 'default':
        this.safeEmit('credit:default', decoded);
        break;
      case 'claim':
        this.safeEmit('credit:claim', decoded);
        break;
    }
  }

  private safeEmit<K extends keyof AegisEventMap>(event: K, ...args: AegisEventMap[K]): void {
    try {
      this.emit(event, ...args);
    } catch (listenerErr) {
      if (event !== 'error') {
        const wrapped = listenerErr instanceof Error ? listenerErr : new Error(String(listenerErr));
        this.emit('error', wrapped);
      }
    }
  }

  private async fetchEventsPage(filters: rpc.Api.EventFilter[]): Promise<rpc.Api.GetEventsResponse> {
    if (this.cursor !== undefined) {
      return this.server.getEvents({
        filters,
        cursor: this.cursor,
        limit: this.pageLimit,
      });
    }
    if (this.nextStartLedger === undefined) {
      const latest = await this.server.getLatestLedger();
      this.nextStartLedger = Math.max(1, latest.sequence - this.lookbackLedgers);
    }
    return this.server.getEvents({
      filters,
      startLedger: this.nextStartLedger,
      limit: this.pageLimit,
    });
  }

  private async executePollCycle(): Promise<AegisContractEvent[]> {
    const filters: rpc.Api.EventFilter[] = [{ type: 'contract', contractIds: this.contractIds }];
    const collected: AegisContractEvent[] = [];

    try {
      for (let page = 0; page < this.maxPagesPerPoll; page++) {
        let response: rpc.Api.GetEventsResponse;
        try {
          response = await this.fetchEventsPage(filters);
        } catch (rpcErr) {
          if (this.autoResetOnRetentionOutOfBounds && isRetentionRangeError(rpcErr)) {
            const error = rpcErr instanceof Error ? rpcErr : new Error(String(rpcErr));
            this.safeEmit('error', error);
            const latest = await this.server.getLatestLedger();
            this.cursor = undefined;
            this.nextStartLedger = Math.max(1, latest.sequence);
            response = await this.server.getEvents({
              filters,
              startLedger: this.nextStartLedger,
              limit: this.pageLimit,
            });
          } else {
            throw rpcErr;
          }
        }

        const priorFailures = this.consecutiveFailures;
        this.consecutiveFailures = 0;
        if (priorFailures > 0) {
          this.safeEmit('reconnected', {
            attempts: priorFailures,
            latestLedger: response.latestLedger,
          });
        }

        const rawEvents = response.events ?? [];
        for (const raw of rawEvents) {
          if (!this.includeFailedCalls && raw.inSuccessfulContractCall === false) {
            continue;
          }
          const dedupeKey =
            raw.id || `${raw.txHash}:${raw.ledger}:${raw.transactionIndex ?? 0}:${raw.operationIndex ?? 0}`;
          if (!this.rememberEventKey(dedupeKey)) {
            continue;
          }
          try {
            const decoded = decodeContractEvent(raw, this.contracts);
            collected.push(decoded);
            this.dispatchDecodedEvent(decoded);
          } catch (decodeErr) {
            const err =
              decodeErr instanceof AegisEventDecodeError
                ? decodeErr
                : new AegisEventDecodeError(
                    'MALFORMED_PAYLOAD',
                    decodeErr instanceof Error ? decodeErr.message : String(decodeErr),
                    raw.id
                  );
            this.safeEmit('malformedEvent', err, raw);
          }
        }

        const previousCursor = this.cursor;
        if (response.cursor) {
          this.cursor = response.cursor;
          this.nextStartLedger = undefined;
        } else if (rawEvents.length > 0) {
          const lastId = rawEvents[rawEvents.length - 1].id;
          if (lastId) {
            this.cursor = lastId;
            this.nextStartLedger = undefined;
          }
        } else if (typeof response.latestLedger === 'number' && response.latestLedger >= 1) {
          this.nextStartLedger = Math.max(this.nextStartLedger ?? 1, response.latestLedger);
        }

        if (typeof response.latestLedger === 'number') {
          this.latestSyncedLedger = response.latestLedger;
          this.safeEmit('ledger', {
            latestLedger: response.latestLedger,
            cursor: this.cursor,
            startLedger: this.nextStartLedger,
          });
        }

        const hasFullPage = rawEvents.length >= this.pageLimit;
        const cursorAdvanced = this.cursor !== undefined && this.cursor !== previousCursor;
        if (!hasFullPage || !cursorAdvanced) {
          break;
        }
      }

      return collected;
    } catch (err) {
      this.consecutiveFailures += 1;
      throw err;
    }
  }
}
