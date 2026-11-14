import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { NETWORKS, type AegisNetwork, type NetworkConfig } from './networks.js';
import { getDeployment } from './deployments.js';
import { AegisEventStream, type AegisClientEventStreamOptions } from './events.js';
import {
  FACILITY_STATUSES,
  REPO_STATUSES,
  type AegisDeployment,
  type CreditFacility,
  type CreditPosition,
  type GateConfig,
  type RepoAgreement,
} from './types.js';

export interface SimulationStats {
  minResourceFee: string;
  instructions: number;
  diskReadBytes: number;
  writeBytes: number;
}

export interface PreparedTransaction {
  xdr: string;
  stats: SimulationStats;
}

export interface SubmittedTransaction {
  hash: string;
  ledger: number;
  returnValue?: unknown;
}

export interface ActivityEvent {
  source: 'repo' | 'credit';
  action: string;
  /** Repo or facility id */
  id: number;
  ledger: number;
  closedAt: string;
  txHash: string;
  account?: string;
  amount?: bigint;
}

export interface ProposeRepoParams {
  collateralToken: string;
  collateralAmount: bigint;
  cashToken: string;
  cashRequested: bigint;
  repoRateBps: number;
  termSeconds: number;
  haircutBps: number;
}

export interface CreateFacilityParams {
  invoiceRef: string;
  currencyToken: string;
  seniorTarget: bigint;
  juniorTarget: bigint;
  seniorAprBps: number;
  juniorAprBps: number;
  durationSeconds: number;
}

const ERRORS: Record<string, Record<number, string>> = {
  repo: {
    1: 'AlreadyInitialized', 2: 'NotInitialized', 3: 'Unauthorized', 4: 'AgreementNotFound', 5: 'InvalidStatus',
    6: 'TermNotExpired', 7: 'TermExpired', 8: 'InvalidAmount', 9: 'HaircutExceeded', 10: 'InvalidTerms', 11: 'NotEligible',
  },
  credit: {
    1: 'AlreadyInitialized', 2: 'Unauthorized', 3: 'FacilityNotFound', 4: 'InvalidStatus', 5: 'TrancheFull',
    6: 'NotFullyFunded', 7: 'InvalidAmount', 8: 'NotInitialized', 9: 'InvalidTerms', 10: 'NotEligible', 11: 'NotDue',
    12: 'NothingToClaim', 13: 'InvalidTranche',
  },
  compliance: {
    1: 'AlreadyInitialized', 2: 'Unauthorized', 3: 'InvestorNotFound', 4: 'SanctionedAddress', 5: 'KycExpired',
    6: 'InsufficientTier',
  },
  settlement: {
    1: 'AlreadyInitialized', 2: 'Unauthorized', 3: 'AnchorNotRegistered', 4: 'SettlementNotFound',
    5: 'AlreadyConfirmed', 6: 'InvalidAmount', 7: 'NotInitialized', 8: 'FacilityNotDrawn',
  },
  token: {
    6: 'AccountMissing', 8: 'NegativeAmount', 9: 'InsufficientAllowance', 10: 'InsufficientBalance',
    11: 'BalanceDeauthorized', 13: 'TrustlineMissing',
  },
};

export class AegisContractError extends Error {
  constructor(
    message: string,
    public readonly raw: string
  ) {
    super(message);
    this.name = 'AegisContractError';
  }
}

const u64 = (n: number | bigint) => nativeToScVal(BigInt(n), { type: 'u64' });
const u32 = (n: number) => nativeToScVal(n, { type: 'u32' });
const i128 = (n: bigint) => nativeToScVal(n, { type: 'i128' });
const addr = (a: string) => new Address(a).toScVal();

export class AegisClient {
  readonly config: NetworkConfig;
  readonly deployment: AegisDeployment;
  readonly server: rpc.Server;

  constructor(network: AegisNetwork = 'testnet', opts: { rpcUrl?: string; deployment?: AegisDeployment } = {}) {
    this.config = { ...NETWORKS[network], ...(opts.rpcUrl ? { rpcUrl: opts.rpcUrl } : {}) };
    this.deployment = opts.deployment ?? getDeployment(network);
    this.server = new rpc.Server(this.config.rpcUrl);
  }

  /** Name the contract error where a host error started */
  describeError(raw: string): string {
    // Diagnostic events are listed newest first, so the last error event is the origin
    const matches = [...raw.matchAll(/contract:(C[A-Z2-7]{55}), topics:\[error, Error\(Contract, #(\d+)\)\]/g)];
    const origin = matches[matches.length - 1];
    const code = origin ? Number(origin[2]) : Number(/Error\(Contract, #(\d+)\)/.exec(raw)?.[1]);
    if (!Number.isFinite(code)) {
      return raw.split('\n')[0].slice(0, 200);
    }
    const ids = this.deployment.contracts;
    const kind =
      Object.entries(ids).find(([, id]) => id === origin?.[1])?.[0] ?? (origin ? 'token' : 'repo');
    return `${ERRORS[kind]?.[code] ?? 'Error'} (${kind} error #${code})`;
  }

  private async simulateRead<T>(contractId: string, method: string, args: xdr.ScVal[] = []): Promise<T> {
    // Read-only calls only need a syntactically valid source; nothing is signed or submitted
    const tx = new TransactionBuilder(new Account(this.deployment.admin, '0'), {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(new Contract(contractId).call(method, ...args))
      .setTimeout(30)
      .build();
    const sim = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new AegisContractError(this.describeError(sim.error), sim.error);
    }
    if (!sim.result) throw new Error(`${method} returned no result`);
    return scValToNative(sim.result.retval) as T;
  }

  private gate(raw: Record<string, any>): GateConfig {
    return { admin: raw.admin, compliance: raw.compliance, requiredTier: Number(raw.required_tier) };
  }

  getRepoConfig(): Promise<GateConfig> {
    return this.simulateRead<Record<string, any>>(this.deployment.contracts.repo, 'get_config').then((c) => this.gate(c));
  }

  getCreditConfig(): Promise<GateConfig> {
    return this.simulateRead<Record<string, any>>(this.deployment.contracts.credit, 'get_config').then((c) => this.gate(c));
  }

  /** Effective compliance tier: 0 if unknown, sanctioned or expired */
  async tierOf(account: string): Promise<number> {
    return Number(await this.simulateRead<number>(this.deployment.contracts.compliance, 'tier_of', [addr(account)]));
  }

  async getRepo(id: number): Promise<RepoAgreement> {
    const r = await this.simulateRead<Record<string, any>>(this.deployment.contracts.repo, 'get_agreement', [u64(id)]);
    return {
      id: Number(r.id),
      borrower: r.borrower,
      lender: r.lender ?? undefined,
      collateralToken: r.collateral_token,
      collateralAmount: BigInt(r.collateral_amount),
      cashToken: r.cash_token,
      cashBorrowed: BigInt(r.cash_borrowed),
      repurchaseAmount: BigInt(r.repurchase_amount),
      repoRateBps: Number(r.repo_rate_bps),
      termSeconds: Number(r.term_seconds),
      haircutBps: Number(r.haircut_bps),
      startTimestamp: Number(r.start_timestamp),
      maturityTimestamp: Number(r.maturity_timestamp),
      status: REPO_STATUSES[Number(r.status)],
    };
  }

  async listRepos(limit = 30): Promise<RepoAgreement[]> {
    const count = Number(await this.simulateRead<bigint>(this.deployment.contracts.repo, 'repo_count'));
    const ids = Array.from({ length: Math.min(count, limit) }, (_, i) => count - i);
    return Promise.all(ids.map((id) => this.getRepo(id)));
  }

  async getFacility(id: number): Promise<CreditFacility> {
    const credit = this.deployment.contracts.credit;
    const [f, owed] = await Promise.all([
      this.simulateRead<Record<string, any>>(credit, 'get_facility', [u64(id)]),
      this.simulateRead<[bigint, bigint]>(credit, 'amounts_owed', [u64(id)]),
    ]);
    return {
      id: Number(f.id),
      borrower: f.borrower,
      invoiceRef: f.invoice_ref,
      currencyToken: f.currency_token,
      seniorTarget: BigInt(f.senior_target),
      juniorTarget: BigInt(f.junior_target),
      seniorFunded: BigInt(f.senior_funded),
      juniorFunded: BigInt(f.junior_funded),
      seniorAprBps: Number(f.senior_apr_bps),
      juniorAprBps: Number(f.junior_apr_bps),
      durationSeconds: Number(f.duration_seconds),
      dueTimestamp: Number(f.due_timestamp),
      repaidAmount: BigInt(f.repaid_amount),
      status: FACILITY_STATUSES[Number(f.status)],
      seniorOwed: BigInt(owed[0]),
      juniorOwed: BigInt(owed[1]),
    };
  }

  async listFacilities(limit = 30): Promise<CreditFacility[]> {
    const count = Number(await this.simulateRead<bigint>(this.deployment.contracts.credit, 'facility_count'));
    const ids = Array.from({ length: Math.min(count, limit) }, (_, i) => count - i);
    return Promise.all(ids.map((id) => this.getFacility(id)));
  }

  async getPosition(facilityId: number, investor: string): Promise<CreditPosition> {
    const p = await this.simulateRead<Record<string, any>>(this.deployment.contracts.credit, 'get_position', [
      u64(facilityId),
      addr(investor),
    ]);
    return {
      senior: BigInt(p.senior),
      junior: BigInt(p.junior),
      claimed: BigInt(p.claimed),
      claimable: BigInt(p.claimable),
    };
  }

  /** Build, simulate and assemble a contract call for `source` to sign */
  async prepareInvocation(source: string, contractId: string, method: string, args: xdr.ScVal[]): Promise<PreparedTransaction> {
    const account = await this.server.getAccount(source);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.config.networkPassphrase })
      .addOperation(new Contract(contractId).call(method, ...args))
      .setTimeout(300)
      .build();
    const sim = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new AegisContractError(this.describeError(sim.error), sim.error);
    }
    const { resources } = sim.transactionData.build();
    return {
      xdr: rpc.assembleTransaction(tx, sim).build().toXDR(),
      stats: {
        minResourceFee: sim.minResourceFee,
        instructions: resources.instructions,
        diskReadBytes: resources.diskReadBytes,
        writeBytes: resources.writeBytes,
      },
    };
  }

  proposeRepo(borrower: string, p: ProposeRepoParams): Promise<PreparedTransaction> {
    return this.prepareInvocation(borrower, this.deployment.contracts.repo, 'propose_repo', [
      addr(borrower),
      addr(p.collateralToken),
      i128(p.collateralAmount),
      addr(p.cashToken),
      i128(p.cashRequested),
      u32(p.repoRateBps),
      u64(p.termSeconds),
      u32(p.haircutBps),
    ]);
  }

  private repoCall(source: string, method: string, id: number) {
    return this.prepareInvocation(source, this.deployment.contracts.repo, method, [addr(source), u64(id)]);
  }

  cancelRepo(borrower: string, id: number) {
    return this.repoCall(borrower, 'cancel_repo', id);
  }

  executeDvp(lender: string, id: number) {
    return this.repoCall(lender, 'execute_dvp', id);
  }

  settleRepo(borrower: string, id: number) {
    return this.repoCall(borrower, 'settle_repurchase', id);
  }

  liquidateRepo(lender: string, id: number) {
    return this.repoCall(lender, 'liquidate_default', id);
  }

  createFacility(borrower: string, p: CreateFacilityParams): Promise<PreparedTransaction> {
    return this.prepareInvocation(borrower, this.deployment.contracts.credit, 'create_facility', [
      addr(borrower),
      nativeToScVal(p.invoiceRef, { type: 'string' }),
      addr(p.currencyToken),
      i128(p.seniorTarget),
      i128(p.juniorTarget),
      u32(p.seniorAprBps),
      u32(p.juniorAprBps),
      u64(p.durationSeconds),
    ]);
  }

  depositTranche(investor: string, facilityId: number, tranche: number, amount: bigint) {
    return this.prepareInvocation(investor, this.deployment.contracts.credit, 'deposit', [
      addr(investor),
      u64(facilityId),
      u32(tranche),
      i128(amount),
    ]);
  }

  private creditCall(source: string, method: string, id: number) {
    return this.prepareInvocation(source, this.deployment.contracts.credit, method, [addr(source), u64(id)]);
  }

  drawdown(borrower: string, facilityId: number) {
    return this.creditCall(borrower, 'drawdown', facilityId);
  }

  claim(investor: string, facilityId: number) {
    return this.creditCall(investor, 'claim', facilityId);
  }

  cancelFacility(borrower: string, facilityId: number) {
    return this.creditCall(borrower, 'cancel_facility', facilityId);
  }

  refund(investor: string, facilityId: number) {
    return this.creditCall(investor, 'refund', facilityId);
  }

  repay(payer: string, facilityId: number, amount: bigint) {
    return this.prepareInvocation(payer, this.deployment.contracts.credit, 'repay', [
      addr(payer),
      u64(facilityId),
      i128(amount),
    ]);
  }

  /** Submit a signed transaction and wait until it is in a ledger */
  async submit(signedXdr: string, timeoutMs = 45_000): Promise<SubmittedTransaction> {
    const tx = TransactionBuilder.fromXDR(signedXdr, this.config.networkPassphrase);
    const sent = await this.server.sendTransaction(tx);
    if (sent.status === 'ERROR' || sent.status === 'TRY_AGAIN_LATER') {
      throw new Error(`Transaction rejected by the network: ${sent.errorResult?.result.type ?? sent.status}`);
    }
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      let res: rpc.Api.GetTransactionResponse;
      try {
        res = await this.server.getTransaction(sent.hash);
      } catch {
        // A dropped poll doesn't mean the transaction failed; keep following the hash
        await new Promise((r) => setTimeout(r, 1_500));
        continue;
      }
      if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        return {
          hash: sent.hash,
          ledger: res.ledger,
          returnValue: res.returnValue ? scValToNative(res.returnValue) : undefined,
        };
      }
      if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`Transaction ${sent.hash} failed on-chain`);
      }
      await new Promise((r) => setTimeout(r, 1_500));
    }
    throw new Error(`Timed out waiting for ${sent.hash}`);
  }

  /** Repo and credit events from the RPC's event window, newest first */
  async getActivity(limit = 25): Promise<ActivityEvent[]> {
    const { repo, credit } = this.deployment.contracts;
    const latest = await this.server.getLatestLedger();
    const filters: rpc.Api.EventFilter[] = [{ type: 'contract', contractIds: [repo, credit] }];

    // RPC scans a bounded range per request, so walk back from the newest ledger
    const WINDOW = 10_000;
    const events: rpc.Api.EventResponse[] = [];
    for (let w = 0; w < 12 && events.length < limit; w += 4) {
      const pages = await Promise.all(
        [0, 1, 2, 3].map(async (i) => {
          const endLedger = latest.sequence - (w + i) * WINDOW;
          try {
            return (
              await this.server.getEvents({ startLedger: Math.max(endLedger - WINDOW, 1), endLedger, filters, limit: 200 })
            ).events;
          } catch {
            return [];
          }
        })
      );
      for (const page of pages) events.push(...page);
    }

    return events
      .sort((a, b) => b.ledger - a.ledger)
      .slice(0, limit)
      .map((e): ActivityEvent => {
        const source = e.contractId?.contractId() === repo ? 'repo' : 'credit';
        const action = String(scValToNative(e.topic[0]));
        const id = Number(scValToNative(e.topic[1]));
        const data = scValToNative(e.value) as unknown;
        const base = { source, action, id, ledger: e.ledger, closedAt: e.ledgerClosedAt, txHash: e.txHash } as const;
        if (!Array.isArray(data)) {
          return typeof data === 'string' ? { ...base, account: data } : { ...base, amount: BigInt(data as bigint) };
        }
        if (source === 'repo') return { ...base, account: data[0], amount: BigInt(data[1]) };
        if (action === 'created') return { ...base, account: data[0], amount: BigInt(data[1]) + BigInt(data[2]) };
        if (action === 'deposit') return { ...base, account: data[0], amount: BigInt(data[2]) };
        return { ...base, account: data[0], amount: BigInt(data[1]) };
      });
  }

  /**
   * Create a typed real-time Soroban RPC event stream listener bound to this client's
   * RPC server and deployed Repo and Credit contract addresses.
   */
  createEventStream(options: AegisClientEventStreamOptions = {}): AegisEventStream {
    const { contracts, ...rest } = options;
    return new AegisEventStream({
      ...rest,
      server: this.server,
      contracts: {
        repo: contracts?.repo ?? this.deployment.contracts.repo,
        credit: contracts?.credit ?? this.deployment.contracts.credit,
      },
    });
  }
}
