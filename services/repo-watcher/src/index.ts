import { AegisClient, fromUnits, type AegisNetwork, type RepoAgreement } from '@aegis-protocol/sdk';

/**
 * Reads every repo agreement from the chain and reports what needs attention.
 * It watches maturity only: there is no price oracle, so it cannot check margin.
 */
export interface RepoReport {
  pending: RepoAgreement[];
  active: RepoAgreement[];
  /** Active and maturing within the warning window */
  dueSoon: RepoAgreement[];
  /** Active and past maturity: the lender can liquidate */
  liquidatable: RepoAgreement[];
}

export async function buildReport(client: AegisClient, warnSeconds = 24 * 60 * 60): Promise<RepoReport> {
  const repos = await client.listRepos(200);
  const now = Math.floor(Date.now() / 1000);
  const active = repos.filter((r) => r.status === 'Active');
  return {
    pending: repos.filter((r) => r.status === 'Pending'),
    active,
    dueSoon: active.filter((r) => r.maturityTimestamp > now && r.maturityTimestamp - now <= warnSeconds),
    liquidatable: active.filter((r) => r.maturityTimestamp <= now),
  };
}

function line(r: RepoAgreement): string {
  const maturity = r.maturityTimestamp ? new Date(r.maturityTimestamp * 1000).toISOString() : 'not funded';
  return `  #${r.id} borrower ${r.borrower.slice(0, 6)}… cash ${fromUnits(r.cashBorrowed)} repurchase ${fromUnits(r.repurchaseAmount)} matures ${maturity}`;
}

async function main(): Promise<void> {
  const network = (process.env.AEGIS_NETWORK ?? 'testnet') as AegisNetwork;
  const client = new AegisClient(network, { rpcUrl: process.env.AEGIS_RPC_URL });
  const report = await buildReport(client);

  console.log(`Aegis repo watcher (${network}) · repo contract ${client.deployment.contracts.repo}`);
  console.log(`pending ${report.pending.length} · active ${report.active.length} · due within 24h ${report.dueSoon.length} · past maturity ${report.liquidatable.length}`);
  if (report.dueSoon.length) console.log('Due within 24h:\n' + report.dueSoon.map(line).join('\n'));
  if (report.liquidatable.length) {
    console.log('Past maturity (lender may call liquidate_default):\n' + report.liquidatable.map(line).join('\n'));
  }
  if (report.pending.length) console.log('Awaiting a lender:\n' + report.pending.map(line).join('\n'));
}

const isEntrypoint = process.argv[1] && /repo-watcher[\\/]dist[\\/]index\.js$/.test(process.argv[1]);
if (isEntrypoint) {
  main().catch((err) => {
    console.error(`error: ${err.message}`);
    process.exit(1);
  });
}
