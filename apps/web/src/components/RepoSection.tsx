'use client';

import React, { useEffect, useState } from 'react';
import { toUnits, type PreparedTransaction, type RepoAgreement } from '@aegis-protocol/sdk';
import { RefreshCw } from 'lucide-react';
import { Badge, Button, Card, ErrorBox, Input, Loading, NoteBox, Section, Stat } from './ui';
import { TxReview } from './TxReview';
import { useWallet } from './WalletProvider';
import { useSorobanTx } from '@/lib/useSorobanTx';
import { errorMessage, fmtUnits, getClient, shortAddr } from '@/lib/aegis';

const STATUS_TONE: Record<RepoAgreement['status'], 'amber' | 'green' | 'blue' | 'slate'> = {
  Pending: 'amber',
  Active: 'blue',
  Closed: 'green',
  Liquidated: 'slate',
  Cancelled: 'slate',
};

export function explainError(message: string) {
  if (message.includes('NotEligible')) {
    return (
      <p className="mt-1 text-red-200/80">
        The repo desk requires the Accredited tier on both sides. On testnet, verification is granted by the Aegis admin.
      </p>
    );
  }
  if (message.includes('InsufficientBalance') || message.includes('TrustlineMissing')) {
    return <p className="mt-1 text-red-200/80">The account doesn&apos;t hold enough of the token for this step.</p>;
  }
  if (message.includes('HaircutExceeded')) {
    return <p className="mt-1 text-red-200/80">Cash requested is above collateral × (1 − haircut).</p>;
  }
  return null;
}

function parse(value: string): bigint | null {
  try {
    const v = toUnits(value);
    return v > 0n ? v : null;
  } catch {
    return null;
  }
}

function useTokenLabel() {
  const { assets } = getClient().deployment;
  return (id: string) => (id === assets.collateral.contractId ? 'XLM' : id === assets.cash.contractId ? 'USDC' : shortAddr(id));
}

function RepoRow({ repo, onAction, active }: { repo: RepoAgreement; onAction: (label: string, build: () => Promise<PreparedTransaction>) => void; active?: React.ReactNode }) {
  const { address } = useWallet();
  const client = getClient();
  const label = useTokenLabel();
  const now = Math.floor(Date.now() / 1000);
  const isBorrower = address === repo.borrower;
  const isLender = !!address && address === repo.lender;

  const actions: [string, () => Promise<PreparedTransaction>][] = [];
  if (address && repo.status === 'Pending') {
    if (isBorrower) actions.push(['Cancel & reclaim collateral', () => client.cancelRepo(address, repo.id)]);
    else actions.push([`Fund ${fmtUnits(repo.cashBorrowed)} ${label(repo.cashToken)} (DvP)`, () => client.executeDvp(address, repo.id)]);
  }
  if (address && repo.status === 'Active') {
    if (isBorrower) actions.push([`Repurchase for ${fmtUnits(repo.repurchaseAmount, 7)} ${label(repo.cashToken)}`, () => client.settleRepo(address, repo.id)]);
    if (isLender && now > repo.maturityTimestamp) actions.push(['Liquidate (past maturity)', () => client.liquidateRepo(address, repo.id)]);
  }

  return (
    <li className="rounded-xl border border-aegis-border/70 bg-aegis-dark/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-white">#{repo.id}</span>
          <Badge tone={STATUS_TONE[repo.status]}>{repo.status}</Badge>
          {isBorrower && <Badge tone="slate">You borrow</Badge>}
          {isLender && <Badge tone="slate">You lend</Badge>}
        </div>
        <span className="text-xs text-slate-500">
          borrower {shortAddr(repo.borrower)}
          {repo.lender && ` · lender ${shortAddr(repo.lender)}`}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label={repo.status === 'Pending' || repo.status === 'Active' ? 'Collateral (in escrow)' : 'Collateral'}
          value={`${fmtUnits(repo.collateralAmount)} ${label(repo.collateralToken)}`}
        />
        <Stat label="Cash" value={`${fmtUnits(repo.cashBorrowed)} ${label(repo.cashToken)}`} />
        <Stat label="Rate · haircut" value={`${repo.repoRateBps / 100}% · ${repo.haircutBps / 100}%`} />
        <Stat
          label={repo.maturityTimestamp ? 'Matures' : 'Term'}
          value={repo.maturityTimestamp ? new Date(repo.maturityTimestamp * 1000).toLocaleString() : `${(repo.termSeconds / 3600).toLocaleString()} h`}
        />
      </div>
      {actions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map(([text, build]) => (
            <Button key={text} variant="secondary" onClick={() => onAction(`${text} · repo #${repo.id}`, build)}>
              {text}
            </Button>
          ))}
        </div>
      )}
      {active}
    </li>
  );
}

export function RepoSection() {
  const { address, status, refreshKey } = useWallet();
  const client = getClient();
  const { assets } = client.deployment;
  const [repos, setRepos] = useState<RepoAgreement[]>();
  const [error, setError] = useState<string>();
  const [reload, setReload] = useState(0);
  const [form, setForm] = useState({ collateral: '100', cash: '10', rate: '5', hours: '24', haircut: '20' });
  const propose = useSorobanTx();
  const rowTx = useSorobanTx();
  const [rowAction, setRowAction] = useState<{ id: number; label: string }>();

  useEffect(() => {
    let cancelled = false;
    setError(undefined);
    client
      .listRepos(20)
      .then((r) => !cancelled && setRepos(r))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [client, refreshKey, reload]);

  const collateral = parse(form.collateral);
  const cash = parse(form.cash);
  const haircutBps = Math.round(Number(form.haircut) * 100);
  const maxCash = collateral !== null && haircutBps >= 0 && haircutBps < 10_000 ? (collateral * BigInt(10_000 - haircutBps)) / 10_000n : null;
  const valid = collateral !== null && cash !== null && Number(form.rate) >= 0 && Number(form.hours) > 0 && maxCash !== null;

  return (
    <Section
      id="repo"
      eyebrow="Repo desk"
      title="Bilateral repo with delivery-versus-payment"
      description="A borrower escrows collateral in the contract and names a cash amount, rate, term and haircut. A lender funds it: cash goes to the borrower in the same transaction. The borrower repurchases for principal plus interest, or after maturity the lender takes the collateral. On testnet the collateral is real XLM and the cash is Circle testnet USDC."
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <div className="text-sm font-semibold text-white">Propose a repo</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {(
              [
                ['collateral', 'XLM collateral'],
                ['cash', 'USDC requested'],
                ['rate', 'Rate (% a year)'],
                ['hours', 'Term (hours)'],
                ['haircut', 'Haircut (%)'],
              ] as const
            ).map(([key, text]) => (
              <label key={key} className="block min-w-0">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">{text}</span>
                <Input
                  inputMode="decimal"
                  value={form[key]}
                  onChange={(e) => {
                    setForm({ ...form, [key]: e.target.value });
                    propose.reset();
                  }}
                />
              </label>
            ))}
            <Stat label="Max cash at this haircut" value={maxCash !== null ? `${fmtUnits(maxCash)} USDC` : '—'} />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            The haircut caps cash at collateral × (1 − haircut) in token units. There is no price oracle yet, so lenders
            price the collateral themselves before funding.
          </p>
          {status === 'connected' && address ? (
            <>
              <Button
                className="mt-3 w-full"
                disabled={!valid || propose.state.phase !== 'idle'}
                onClick={() =>
                  propose.prepare(() =>
                    client.proposeRepo(address, {
                      collateralToken: assets.collateral.contractId,
                      collateralAmount: collateral!,
                      cashToken: assets.cash.contractId,
                      cashRequested: cash!,
                      repoRateBps: Math.round(Number(form.rate) * 100),
                      termSeconds: Math.round(Number(form.hours) * 3600),
                      haircutBps,
                    })
                  )
                }
              >
                Review proposal
              </Button>
              <TxReview
                state={propose.state}
                onConfirm={propose.confirm}
                onCancel={propose.reset}
                explainError={explainError}
                describeResult={(v) => `Repo #${String(v)} proposed; your collateral is in escrow.`}
              />
            </>
          ) : (
            <p className="mt-3 text-xs text-slate-400">Connect Freighter to propose or fund repos.</p>
          )}
        </Card>

        <Card className="lg:col-span-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-white">Order book (read from the contract)</span>
            <Button variant="secondary" onClick={() => setReload((r) => r + 1)} className="px-3" aria-label="Reload repos">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          {error && <ErrorBox>Could not read repos: {error}</ErrorBox>}
          {!repos && !error && <Loading label="Reading repo agreements…" />}
          {repos && repos.length === 0 && <p className="text-sm text-slate-400">No repos yet.</p>}
          {repos && repos.length > 0 && (
            <ul className="space-y-3">
              {repos.map((r) => (
                <RepoRow
                  key={r.id}
                  repo={r}
                  onAction={(label, build) => {
                    setRowAction({ id: r.id, label });
                    rowTx.prepare(build);
                  }}
                  active={
                    rowAction?.id === r.id && rowTx.state.phase !== 'idle' ? (
                      <TxReview
                        state={rowTx.state}
                        onConfirm={rowTx.confirm}
                        onCancel={() => {
                          rowTx.reset();
                          setRowAction(undefined);
                        }}
                        explainError={explainError}
                        describeResult={() => `${rowAction.label} confirmed.`}
                      />
                    ) : undefined
                  }
                />
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div className="mt-4">
        <NoteBox>
          Only the original borrower can repurchase, and collateral only leaves escrow through repurchase, cancellation or
          liquidation after maturity.
        </NoteBox>
      </div>
    </Section>
  );
}
