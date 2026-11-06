'use client';

import React, { useEffect, useState } from 'react';
import { RECEIPTS, explorerAccountUrl, explorerTxUrl, type ActivityEvent } from '@aegis-protocol/sdk';
import { RefreshCw } from 'lucide-react';
import { Badge, Button, Card, ErrorBox, ExtLink, Loading, NoteBox, Section } from './ui';
import { useWallet } from './WalletProvider';
import { NETWORK, errorMessage, fmtUnits, getClient, shortAddr, timeAgo } from '@/lib/aegis';

function EventRow({ e }: { e: ActivityEvent }) {
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-aegis-border/60 bg-aegis-dark/50 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        <Badge tone={e.source === 'repo' ? 'amber' : 'blue'}>{e.source === 'repo' ? 'Repo' : 'Credit'}</Badge>
        <span className="font-mono text-slate-200">
          {e.action} #{e.id}
        </span>
        {e.amount !== undefined && <span className="font-mono text-slate-300">{fmtUnits(e.amount)} USDC</span>}
        {e.account && <span className="text-slate-500">{shortAddr(e.account)}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs text-slate-500">
        <span>
          ledger {e.ledger.toLocaleString('en-US')} · {timeAgo(e.closedAt)}
        </span>
        <ExtLink href={explorerTxUrl(NETWORK, e.txHash)}>tx</ExtLink>
      </div>
    </li>
  );
}

export function ActivitySection() {
  const { refreshKey } = useWallet();
  const [events, setEvents] = useState<ActivityEvent[]>();
  const [error, setError] = useState<string>();
  const [reload, setReload] = useState(0);
  const run = RECEIPTS.find((r) => r.network === 'testnet');

  useEffect(() => {
    let cancelled = false;
    setError(undefined);
    setEvents(undefined);
    getClient()
      .getActivity(25)
      .then((ev) => !cancelled && setEvents(ev))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [refreshKey, reload]);

  return (
    <Section
      id="activity"
      eyebrow="On-chain"
      title="Activity"
      description="Events emitted by the repo and credit contracts, read from Soroban RPC. The public RPC keeps roughly the last 7 days of events."
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-white">Recent events</span>
            <Button variant="secondary" onClick={() => setReload((r) => r + 1)} className="px-3" aria-label="Reload activity">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          {error && <ErrorBox>Could not read events: {error}</ErrorBox>}
          {!events && !error && <Loading label="Scanning contract events…" />}
          {events && events.length === 0 && <p className="text-sm text-slate-400">No events in the RPC&apos;s retention window yet.</p>}
          {events && events.length > 0 && (
            <ul className="space-y-2">
              {events.map((e) => (
                <EventRow key={`${e.txHash}-${e.source}-${e.action}-${e.id}`} e={e} />
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <div className="text-sm font-semibold text-white">Verified test run</div>
          {run ? (
            <>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Scripted end-to-end run (<span className="font-mono">scripts/e2e-testnet.mjs</span>) on {new Date(run.ranAt).toUTCString()} with
                fresh accounts, real testnet XLM as collateral and USDC bought on the DEX. Every step asserts on-chain state.
              </p>
              <div className="mt-2 text-xs">
                Borrower <ExtLink href={explorerAccountUrl(NETWORK, run.account)} className="font-mono">{shortAddr(run.account, 6, 6)}</ExtLink>
              </div>
              <ol className="mt-3 space-y-2">
                {run.receipts.map((r) => (
                  <li key={r.txHash} className="rounded-lg border border-aegis-border/60 bg-aegis-dark/50 p-2.5 text-xs">
                    <div className="font-semibold text-slate-200">{r.step}</div>
                    <div className="mt-0.5 text-slate-400">{r.detail}</div>
                    <ExtLink href={explorerTxUrl(NETWORK, r.txHash)} className="mt-1 font-mono text-[11px]">
                      {shortAddr(r.txHash, 10, 6)}
                    </ExtLink>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <NoteBox>No recorded run yet.</NoteBox>
          )}
        </Card>
      </div>
    </Section>
  );
}
