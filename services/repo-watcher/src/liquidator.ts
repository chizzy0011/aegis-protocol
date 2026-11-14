import {
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  rpc,
} from '@stellar/stellar-sdk';
import type { AegisClient, RepoAgreement, SubmittedTransaction } from '@aegis-protocol/sdk';

/** Signed 128-bit upper bound matching Soroban SDK 22 `i128` */
export const I128_MAX = (1n << 127n) - 1n;

/** Unsigned 64-bit upper bound matching Soroban SDK 22 `u64` */
export const U64_MAX = (1n << 64n) - 1n;

/** Maximum reasonable grace period (365 days in seconds) */
export const MAX_GRACE_PERIOD_SECONDS = 365 * 24 * 60 * 60;

/** Default ceiling on base + Soroban resource fee (0.5 XLM = 5,000,000 stroops) */
export const DEFAULT_MAX_FEE_STROOPS = 5_000_000n;

/** Default transaction validity window in seconds */
export const DEFAULT_TX_TIMEOUT_SECONDS = 180;

export type LiquidationErrorCode =
  | 'INVALID_CONFIG'
  | 'INVALID_AGREEMENT'
  | 'INVALID_STATUS'
  | 'MISSING_LENDER'
  | 'UNAUTHORIZED_LENDER'
  | 'GRACE_PERIOD_NOT_EXPIRED'
  | 'TERM_NOT_EXPIRED'
  | 'AGREEMENT_NOT_FOUND'
  | 'FEE_CAP_EXCEEDED'
  | 'MISSING_SIGNER'
  | 'SIMULATION_FAILED'
  | 'BROADCAST_FAILED';

export class LiquidationError extends Error {
  constructor(
    public readonly code: LiquidationErrorCode,
    message: string,
    public readonly repoId?: number,
    public readonly causeRaw?: string
  ) {
    super(message);
    this.name = 'LiquidationError';
  }
}

export interface LiquidationResourceStats {
  baseFeeStroops: bigint;
  minResourceFeeStroops: bigint;
  totalFeeStroops: bigint;
  instructions: number;
  diskReadBytes: number;
  writeBytes: number;
}

export interface GeneratedLiquidationEnvelope {
  repoId: number;
  lender: string;
  borrower: string;
  collateralToken: string;
  collateralAmount: bigint;
  cashBorrowed: bigint;
  maturityTimestamp: number;
  gracePeriodSeconds: number;
  /** Latest timestamp still inside the grace period (`maturityTimestamp + gracePeriodSeconds`) */
  eligibleAfterTimestamp: number;
  unsignedXdr: string;
  signedXdr?: string;
  txHash: string;
  stats: LiquidationResourceStats;
}

export interface LiquidationExecutionResult {
  repoId: number;
  status: 'submitted' | 'dry-run' | 'skipped';
  envelope?: GeneratedLiquidationEnvelope;
  submission?: SubmittedTransaction;
  skipReason?: string;
}

export interface BatchLiquidationFailure {
  repoId: number;
  code: LiquidationErrorCode;
  message: string;
}

export interface BatchLiquidationSummary {
  evaluatedAtTimestamp: number;
  eligibleCount: number;
  results: LiquidationExecutionResult[];
  failures: BatchLiquidationFailure[];
}

export interface LiquidationSigner {
  publicKey(): string;
  sign(txXdr: string, networkPassphrase: string): string | Promise<string>;
}

export interface AtomicLiquidationOptions {
  /** Post-maturity grace period in seconds before a repo is treated as defaulted (default: 0) */
  gracePeriodSeconds?: number;
  /** Base inclusion fee in stroops before Soroban resource fee (default: Stellar `BASE_FEE` = 100) */
  baseFeeStroops?: number | bigint;
  /** Hard ceiling on `baseFeeStroops + minResourceFeeStroops` in stroops (default: 5_000_000n) */
  maxFeeStroops?: number | bigint;
  /** Transaction `TimeBounds` timeout in seconds (default: 180) */
  txTimeoutSeconds?: number;
  /** Transaction confirmation timeout in milliseconds when broadcasting (default: 45_000) */
  submitTimeoutMs?: number;
  /** Construct and simulate envelopes without signing or broadcasting (default: false when signer set, true otherwise) */
  dryRun?: boolean;
  /** Re-read `client.getRepo(id)` immediately before constructing each envelope to guard against last-second borrower settlement (default: true) */
  reverifyOnChain?: boolean;
  /** Optional lender public key filter (`G...`); defaults to `signer.publicKey()` when a signer is supplied */
  lenderPublicKey?: string;
  /** Lender `Keypair` or external HSM/KMS `LiquidationSigner` used to authorize `liquidate_default` */
  signer?: Keypair | LiquidationSigner;
  /** Injectable clock returning current UNIX timestamp in seconds (defaults to `Math.floor(Date.now() / 1000)`) */
  nowSeconds?: () => number;
}

function isKeypair(signer: Keypair | LiquidationSigner): signer is Keypair {
  return (
    signer instanceof Keypair ||
    typeof (signer as unknown as { secret?: unknown }).secret === 'function'
  );
}

/** Wrap a Stellar `Keypair` into a `LiquidationSigner` without exposing its secret */
export function createKeypairSigner(keypair: Keypair): LiquidationSigner {
  return {
    publicKey: () => keypair.publicKey(),
    sign: (txXdr: string, networkPassphrase: string): string => {
      const tx = TransactionBuilder.fromXDR(txXdr, networkPassphrase);
      tx.sign(keypair);
      return tx.toXDR();
    },
  };
}

function toSafeStroops(value: number | bigint, name: string, minValue: bigint): bigint {
  let asBigInt: bigint;
  if (typeof value === 'bigint') {
    asBigInt = value;
  } else if (typeof value === 'number' && Number.isInteger(value) && Number.isSafeInteger(value)) {
    asBigInt = BigInt(value);
  } else {
    throw new LiquidationError('INVALID_CONFIG', `${name} must be a safe integer or bigint, got ${String(value)}`);
  }
  if (asBigInt < minValue || asBigInt > U64_MAX) {
    throw new LiquidationError(
      'INVALID_CONFIG',
      `${name} (${asBigInt.toString()}) must be in [${minValue.toString()}, U64_MAX]`
    );
  }
  return asBigInt;
}

function mapContractErrorCode(described: string, raw: string): LiquidationErrorCode {
  if (/TermNotExpired|repo error #6|Error\(Contract, #6\)/.test(described) || /Error\(Contract, #6\)/.test(raw)) {
    return 'TERM_NOT_EXPIRED';
  }
  if (/InvalidStatus|repo error #5|Error\(Contract, #5\)/.test(described) || /Error\(Contract, #5\)/.test(raw)) {
    return 'INVALID_STATUS';
  }
  if (/Unauthorized|repo error #3|Error\(Contract, #3\)/.test(described) || /Error\(Contract, #3\)/.test(raw)) {
    return 'UNAUTHORIZED_LENDER';
  }
  if (
    /AgreementNotFound|repo error #4|Error\(Contract, #4\)/.test(described) ||
    /Error\(Contract, #4\)/.test(raw)
  ) {
    return 'AGREEMENT_NOT_FOUND';
  }
  return 'SIMULATION_FAILED';
}

/**
 * Compute `maturityTimestamp + gracePeriodSeconds` using safe `BigInt` arithmetic.
 * Note `AegisRepoContract::liquidate_default` checks `ledger.timestamp() <= maturity_timestamp`,
 * so liquidation is valid strictly AFTER `eligibleAfterTimestamp` (`nowTimestamp > eligibleAfterTimestamp`).
 */
export function computeEligibleAfterTimestamp(maturityTimestamp: number, gracePeriodSeconds: number): number {
  if (!Number.isInteger(maturityTimestamp) || maturityTimestamp <= 0) {
    throw new LiquidationError(
      'INVALID_AGREEMENT',
      `maturityTimestamp must be a positive integer for an active repo, got ${maturityTimestamp}`
    );
  }
  if (
    !Number.isInteger(gracePeriodSeconds) ||
    gracePeriodSeconds < 0 ||
    gracePeriodSeconds > MAX_GRACE_PERIOD_SECONDS
  ) {
    throw new LiquidationError(
      'INVALID_CONFIG',
      `gracePeriodSeconds must be an integer in [0, ${MAX_GRACE_PERIOD_SECONDS}], got ${gracePeriodSeconds}`
    );
  }
  const sum = BigInt(maturityTimestamp) + BigInt(gracePeriodSeconds);
  if (sum > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new LiquidationError('INVALID_AGREEMENT', 'Maturity + grace period overflows safe timestamp range');
  }
  return Number(sum);
}

/**
 * Return `true` iff `agreement` is an active, funded repo whose post-maturity grace period
 * has strictly expired at `nowTimestamp` (and matches `lenderPublicKey` if specified).
 */
export function isDefaultedAndEligible(
  agreement: RepoAgreement,
  nowTimestamp: number,
  gracePeriodSeconds = 0,
  lenderPublicKey?: string
): boolean {
  if (agreement.status !== 'Active') return false;
  if (!agreement.lender || !StrKey.isValidEd25519PublicKey(agreement.lender)) return false;
  if (lenderPublicKey && agreement.lender !== lenderPublicKey) return false;
  if (agreement.maturityTimestamp <= 0) return false;
  if (agreement.collateralAmount <= 0n || agreement.collateralAmount > I128_MAX) return false;
  const threshold = computeEligibleAfterTimestamp(agreement.maturityTimestamp, gracePeriodSeconds);
  return BigInt(Math.floor(nowTimestamp)) > BigInt(threshold);
}

/**
 * Validate `agreement` for atomic liquidation and throw a typed `LiquidationError`
 * naming the exact invariant violated when ineligible.
 */
export function assertLiquidationEligible(
  agreement: RepoAgreement,
  nowTimestamp: number,
  gracePeriodSeconds = 0,
  expectedLender?: string
): { lender: string; eligibleAfterTimestamp: number } {
  if (!Number.isInteger(agreement.id) || agreement.id < 1 || BigInt(agreement.id) > U64_MAX) {
    throw new LiquidationError(
      'INVALID_AGREEMENT',
      `Invalid repo agreement id: ${String(agreement.id)}`,
      agreement.id
    );
  }
  if (agreement.status !== 'Active') {
    throw new LiquidationError(
      'INVALID_STATUS',
      `Repo #${agreement.id} has status '${agreement.status}'; only 'Active' repos can be liquidated`,
      agreement.id
    );
  }
  if (!agreement.lender || !StrKey.isValidEd25519PublicKey(agreement.lender)) {
    throw new LiquidationError(
      'MISSING_LENDER',
      `Repo #${agreement.id} has no valid lender address recorded`,
      agreement.id
    );
  }
  if (expectedLender && agreement.lender !== expectedLender) {
    throw new LiquidationError(
      'UNAUTHORIZED_LENDER',
      `Repo #${agreement.id} lender ${agreement.lender} does not match configured liquidator ${expectedLender}`,
      agreement.id
    );
  }
  if (agreement.collateralAmount <= 0n || agreement.collateralAmount > I128_MAX) {
    throw new LiquidationError(
      'INVALID_AGREEMENT',
      `Repo #${agreement.id} collateralAmount (${agreement.collateralAmount.toString()}) is outside valid positive i128 range`,
      agreement.id
    );
  }

  const eligibleAfterTimestamp = computeEligibleAfterTimestamp(
    agreement.maturityTimestamp,
    gracePeriodSeconds
  );
  if (BigInt(Math.floor(nowTimestamp)) <= BigInt(eligibleAfterTimestamp)) {
    throw new LiquidationError(
      'GRACE_PERIOD_NOT_EXPIRED',
      `Repo #${agreement.id} grace period expires strictly after ${eligibleAfterTimestamp} (current timestamp: ${Math.floor(nowTimestamp)})`,
      agreement.id
    );
  }

  return { lender: agreement.lender, eligibleAfterTimestamp };
}

/**
 * Construct, simulate, fee-check, assemble (and optionally sign) an atomic Soroban SDK 22
 * `liquidate_default(lender, repo_id)` transaction envelope for a defaulted repo agreement.
 */
export class AtomicLiquidationGenerator {
  private readonly gracePeriodSeconds: number;
  private readonly baseFeeStroops: bigint;
  private readonly maxFeeStroops: bigint;
  private readonly txTimeoutSeconds: number;
  private readonly submitTimeoutMs: number;
  private readonly dryRun: boolean;
  private readonly reverifyOnChain: boolean;
  private readonly signer?: LiquidationSigner;
  private readonly lenderFilter?: string;
  private readonly nowSeconds: () => number;
  private readonly inflightRepoIds = new Set<number>();
  private readonly liquidatedRepoIds = new Set<number>();

  constructor(
    private readonly client: AegisClient,
    options: AtomicLiquidationOptions = {}
  ) {
    const grace = options.gracePeriodSeconds ?? 0;
    if (!Number.isInteger(grace) || grace < 0 || grace > MAX_GRACE_PERIOD_SECONDS) {
      throw new LiquidationError(
        'INVALID_CONFIG',
        `gracePeriodSeconds must be an integer in [0, ${MAX_GRACE_PERIOD_SECONDS}], got ${grace}`
      );
    }

    const baseFee = toSafeStroops(
      options.baseFeeStroops ?? Number(BASE_FEE),
      'baseFeeStroops',
      BigInt(BASE_FEE)
    );
    if (baseFee > BigInt( 0xffffffff )) {
      throw new LiquidationError('INVALID_CONFIG', `baseFeeStroops exceeds u32 Stellar fee limit: ${baseFee}`);
    }

    const maxFee = toSafeStroops(
      options.maxFeeStroops ?? DEFAULT_MAX_FEE_STROOPS,
      'maxFeeStroops',
      baseFee
    );

    const txTimeout = options.txTimeoutSeconds ?? DEFAULT_TX_TIMEOUT_SECONDS;
    if (!Number.isInteger(txTimeout) || txTimeout < 10 || txTimeout > 3_600) {
      throw new LiquidationError(
        'INVALID_CONFIG',
        `txTimeoutSeconds must be an integer in [10, 3600], got ${txTimeout}`
      );
    }

    const submitTimeout = options.submitTimeoutMs ?? 45_000;
    if (!Number.isInteger(submitTimeout) || submitTimeout < 1_000) {
      throw new LiquidationError(
        'INVALID_CONFIG',
        `submitTimeoutMs must be an integer >= 1000, got ${submitTimeout}`
      );
    }

    const normalizedSigner = options.signer
      ? isKeypair(options.signer)
        ? createKeypairSigner(options.signer)
        : options.signer
      : undefined;

    const lenderKey = options.lenderPublicKey ?? normalizedSigner?.publicKey();
    if (lenderKey !== undefined && !StrKey.isValidEd25519PublicKey(lenderKey)) {
      throw new LiquidationError('INVALID_CONFIG', `Invalid Stellar G... lenderPublicKey: ${lenderKey}`);
    }
    if (normalizedSigner && lenderKey && normalizedSigner.publicKey() !== lenderKey) {
      throw new LiquidationError(
        'INVALID_CONFIG',
        `signer public key (${normalizedSigner.publicKey()}) does not match lenderPublicKey (${lenderKey})`
      );
    }

    const dryRun = options.dryRun ?? normalizedSigner === undefined;
    if (!dryRun && !normalizedSigner) {
      throw new LiquidationError(
        'MISSING_SIGNER',
        'Live atomic liquidation broadcast requires a signer (or set dryRun: true)'
      );
    }

    this.gracePeriodSeconds = grace;
    this.baseFeeStroops = baseFee;
    this.maxFeeStroops = maxFee;
    this.txTimeoutSeconds = txTimeout;
    this.submitTimeoutMs = submitTimeout;
    this.dryRun = dryRun;
    this.reverifyOnChain = options.reverifyOnChain ?? true;
    this.signer = normalizedSigner;
    this.lenderFilter = lenderKey;
    this.nowSeconds = options.nowSeconds ?? (() => Math.floor(Date.now() / 1000));
  }

  /** Return all agreements in `repos` eligible for atomic liquidation at current clock */
  findDefaultedRepos(repos: RepoAgreement[], nowTimestamp = this.nowSeconds()): RepoAgreement[] {
    return repos
      .filter(
        (r) =>
          !this.liquidatedRepoIds.has(r.id) &&
          !this.inflightRepoIds.has(r.id) &&
          isDefaultedAndEligible(r, nowTimestamp, this.gracePeriodSeconds, this.lenderFilter)
      )
      .sort((a, b) => a.maturityTimestamp - b.maturityTimestamp || a.id - b.id);
  }

  /** Build, simulate, fee-check, assemble, and (if signer is present) sign an atomic liquidation envelope */
  async generateEnvelope(
    agreement: RepoAgreement,
    nowTimestamp = this.nowSeconds()
  ): Promise<GeneratedLiquidationEnvelope> {
    const { lender, eligibleAfterTimestamp } = assertLiquidationEligible(
      agreement,
      nowTimestamp,
      this.gracePeriodSeconds,
      this.lenderFilter
    );

    const account = await this.client.server.getAccount(lender);
    const repoContractId = this.client.deployment.contracts.repo;
    const rawTx = new TransactionBuilder(account, {
      fee: this.baseFeeStroops.toString(),
      networkPassphrase: this.client.config.networkPassphrase,
    })
      .addOperation(
        new Contract(repoContractId).call(
          'liquidate_default',
          new Address(lender).toScVal(),
          nativeToScVal(BigInt(agreement.id), { type: 'u64' })
        )
      )
      .setTimeout(this.txTimeoutSeconds)
      .build();

    const sim = await this.client.server.simulateTransaction(rawTx);
    if (rpc.Api.isSimulationError(sim)) {
      const described = this.client.describeError(sim.error);
      const code = mapContractErrorCode(described, sim.error);
      throw new LiquidationError(
        code,
        `Simulation failed for repo #${agreement.id}: ${described}`,
        agreement.id,
        sim.error
      );
    }

    const minResourceFeeStroops = toSafeStroops(
      BigInt(sim.minResourceFee || '0'),
      'minResourceFee',
      0n
    );
    const totalFeeStroops = this.baseFeeStroops + minResourceFeeStroops;
    if (totalFeeStroops > this.maxFeeStroops) {
      throw new LiquidationError(
        'FEE_CAP_EXCEEDED',
        `Repo #${agreement.id} total liquidation fee (${totalFeeStroops} stroops) exceeds maxFeeStroops (${this.maxFeeStroops} stroops)`,
        agreement.id
      );
    }

    const { resources } = sim.transactionData.build();
    const assembled = rpc.assembleTransaction(rawTx, sim).build();
    const unsignedXdr = assembled.toXDR();
    const txHash = Buffer.from(assembled.hash()).toString('hex');

    let signedXdr: string | undefined;
    if (this.signer) {
      signedXdr = await this.signer.sign(unsignedXdr, this.client.config.networkPassphrase);
    }

    return {
      repoId: agreement.id,
      lender,
      borrower: agreement.borrower,
      collateralToken: agreement.collateralToken,
      collateralAmount: agreement.collateralAmount,
      cashBorrowed: agreement.cashBorrowed,
      maturityTimestamp: agreement.maturityTimestamp,
      gracePeriodSeconds: this.gracePeriodSeconds,
      eligibleAfterTimestamp,
      unsignedXdr,
      signedXdr,
      txHash,
      stats: {
        baseFeeStroops: this.baseFeeStroops,
        minResourceFeeStroops,
        totalFeeStroops,
        instructions: resources.instructions,
        diskReadBytes: resources.diskReadBytes,
        writeBytes: resources.writeBytes,
      },
    };
  }

  /** Execute (or dry-run) atomic liquidation for a single agreement with idempotency & race guards */
  async liquidateOne(
    agreement: RepoAgreement,
    nowTimestamp = this.nowSeconds()
  ): Promise<LiquidationExecutionResult> {
    if (this.liquidatedRepoIds.has(agreement.id)) {
      return {
        repoId: agreement.id,
        status: 'skipped',
        skipReason: 'already liquidated in this session',
      };
    }
    if (this.inflightRepoIds.has(agreement.id)) {
      return {
        repoId: agreement.id,
        status: 'skipped',
        skipReason: 'liquidation already in flight',
      };
    }

    this.inflightRepoIds.add(agreement.id);
    try {
      let target = agreement;
      if (this.reverifyOnChain) {
        target = await this.client.getRepo(agreement.id);
        if (target.status !== 'Active') {
          if (target.status === 'Liquidated') {
            this.liquidatedRepoIds.add(target.id);
          }
          return {
            repoId: target.id,
            status: 'skipped',
            skipReason: `on-chain status moved to '${target.status}' before liquidation`,
          };
        }
      }

      const envelope = await this.generateEnvelope(target, nowTimestamp);
      if (this.dryRun) {
        return {
          repoId: target.id,
          status: 'dry-run',
          envelope,
        };
      }

      if (!envelope.signedXdr) {
        throw new LiquidationError(
          'MISSING_SIGNER',
          `Envelope for repo #${target.id} was not signed`,
          target.id
        );
      }

      try {
        const submission = await this.client.submit(envelope.signedXdr, this.submitTimeoutMs);
        this.liquidatedRepoIds.add(target.id);
        return {
          repoId: target.id,
          status: 'submitted',
          envelope,
          submission,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new LiquidationError(
          'BROADCAST_FAILED',
          `Broadcast failed for repo #${target.id}: ${msg}`,
          target.id,
          msg
        );
      }
    } finally {
      this.inflightRepoIds.delete(agreement.id);
    }
  }

  /**
   * Scan on-chain repos (or a provided list), filter defaulted ones past the grace period,
   * and sequentially generate & broadcast atomic liquidation envelopes so account sequence
   * numbers advance deterministically without collisions.
   */
  async processDefaultedRepos(repos?: RepoAgreement[], limit = 200): Promise<BatchLiquidationSummary> {
    const evaluatedAtTimestamp = this.nowSeconds();
    const candidates = repos ?? (await this.client.listRepos(limit));
    const eligible = this.findDefaultedRepos(candidates, evaluatedAtTimestamp);

    const results: LiquidationExecutionResult[] = [];
    const failures: BatchLiquidationFailure[] = [];

    for (const agreement of eligible) {
      try {
        const outcome = await this.liquidateOne(agreement, evaluatedAtTimestamp);
        results.push(outcome);
      } catch (err) {
        if (err instanceof LiquidationError) {
          failures.push({ repoId: agreement.id, code: err.code, message: err.message });
        } else {
          failures.push({
            repoId: agreement.id,
            code: 'BROADCAST_FAILED',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    return {
      evaluatedAtTimestamp,
      eligibleCount: eligible.length,
      results,
      failures,
    };
  }
}
