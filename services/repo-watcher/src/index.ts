import { Keypair } from '@stellar/stellar-sdk';
import { AegisClient, fromUnits, type AegisNetwork, type RepoAgreement } from '@aegis-protocol/sdk';
import {
  AtomicLiquidationGenerator,
  DEFAULT_MAX_FEE_STROOPS,
  isDefaultedAndEligible,
} from './liquidator.js';

export * from './liquidator.js';

/**
 * Reads every repo agreement from the chain and reports what needs attention.
 * It watches maturity and post-maturity grace expiry: there is no price oracle, so it cannot check margin.
 */
export interface RepoReport {
  pending: RepoAgreement[];
  active: RepoAgreement[];
  /** Active and maturing within the warning window */
  dueSoon: RepoAgreement[];
  /** Active and strictly past `maturityTimestamp + gracePeriodSeconds`: the lender can liquidate */
  liquidatable: RepoAgreement[];
}

export async function buildReport(
  client: AegisClient,
  warnSeconds = 24 * 60 * 60,
  gracePeriodSeconds = 0,
  nowTimestamp = Math.floor(Date.now() / 1000)
): Promise<RepoReport> {
  const repos = await client.listRepos(200);
  const active = repos.filter((r) => r.status === 'Active');
  return {
    pending: repos.filter((r) => r.status === 'Pending'),
    active,
    dueSoon: active.filter(
      (r) => r.maturityTimestamp > nowTimestamp && r.maturityTimestamp - nowTimestamp <= warnSeconds
    ),
    liquidatable: active.filter((r) => isDefaultedAndEligible(r, nowTimestamp, gracePeriodSeconds)),
  };
}

function line(r: RepoAgreement): string {
  const maturity = r.maturityTimestamp ? new Date(r.maturityTimestamp * 1000).toISOString() : 'not funded';
  return `  #${r.id} borrower ${r.borrower.slice(0, 6)}… cash ${fromUnits(r.cashBorrowed)} repurchase ${fromUnits(r.repurchaseAmount)} matures ${maturity}`;
}

async function main(): Promise<void> {
  const network = (process.env.AEGIS_NETWORK ?? 'testnet') as AegisNetwork;
  const gracePeriodSeconds = Number(process.env.AEGIS_GRACE_PERIOD_SECONDS ?? '0');
  const maxFeeStroops = process.env.AEGIS_MAX_FEE_STROOPS
    ? BigInt(process.env.AEGIS_MAX_FEE_STROOPS)
    : DEFAULT_MAX_FEE_STROOPS;

  const client = new AegisClient(network, { rpcUrl: process.env.AEGIS_RPC_URL });
  const report = await buildReport(client, 24 * 60 * 60, gracePeriodSeconds);

  console.log(`Aegis repo watcher (${network}) · repo contract ${client.deployment.contracts.repo}`);
  console.log(
    `pending ${report.pending.length} · active ${report.active.length} · due within 24h ${report.dueSoon.length} · past maturity/grace ${report.liquidatable.length}`
  );
  if (report.dueSoon.length) console.log('Due within 24h:\n' + report.dueSoon.map(line).join('\n'));
  if (report.liquidatable.length) {
    console.log('Past maturity (lender may call liquidate_default):\n' + report.liquidatable.map(line).join('\n'));
  }
  if (report.pending.length) console.log('Awaiting a lender:\n' + report.pending.map(line).join('\n'));

  const autoLiquidate = process.env.AEGIS_AUTO_LIQUIDATE === 'true';
  const dryRunFlag = process.env.AEGIS_LIQUIDATE_DRY_RUN === 'true';
  if ((autoLiquidate || dryRunFlag) && report.liquidatable.length > 0) {
    const signer = process.env.AEGIS_LENDER_SECRET
      ? Keypair.fromSecret(process.env.AEGIS_LENDER_SECRET)
      : undefined;
    const generator = new AtomicLiquidationGenerator(client, {
      gracePeriodSeconds,
      maxFeeStroops,
      signer,
      dryRun: dryRunFlag || !signer,
    });
    const summary = await generator.processDefaultedRepos(report.liquidatable);
    for (const r of summary.results) {
      if (r.status === 'submitted' && r.submission) {
        console.log(`  liquidated #${r.repoId} · tx ${r.submission.hash} (ledger ${r.submission.ledger})`);
      } else if (r.status === 'dry-run' && r.envelope) {
        console.log(
          `  prepared liquidation #${r.repoId} (dry-run) · hash ${r.envelope.txHash} · totalFee ${r.envelope.stats.totalFeeStroops} stroops`
        );
      } else if (r.status === 'skipped') {
        console.log(`  skipped #${r.repoId} · ${r.skipReason}`);
      }
    }
    for (const f of summary.failures) {
      console.error(`  liquidation failed #${f.repoId} [${f.code}]: ${f.message}`);
    }
  }
}

const isEntrypoint = process.argv[1] && /repo-watcher[\\/]dist[\\/]index\.js$/.test(process.argv[1]);
if (isEntrypoint) {
  main().catch((err) => {
    console.error(`error: ${err.message}`);
    process.exit(1);
  });
}
