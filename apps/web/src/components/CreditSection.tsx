'use client';

import React, { useEffect, useState } from 'react';
import { JUNIOR, SENIOR, toUnits, type CreditFacility, type CreditPosition, type PreparedTransaction } from '@aegis-protocol/sdk';
import { RefreshCw } from 'lucide-react';
import { Badge, Button, Card, ErrorBox, Input, Loading, NoteBox, Section, Stat } from './ui';
import { TxReview } from './TxReview';
import { explainError } from './RepoSection';
import { useWallet } from './WalletProvider';
import { useSorobanTx } from '@/lib/useSorobanTx';
import { errorMessage, fmtUnits, getClient, shortAddr } from '@/lib/aegis';

type Row = { facility: CreditFacility; position?: CreditPosition };

const STATUS_TONE: Record<CreditFacility['status'], 'amber' | 'green' | 'blue' | 'slate'> = {
  Fundraising: 'amber',
  Active: 'blue',
  Repaid: 'green',
  Defaulted: 'slate',
  Cancelled: 'slate',
};

function parse(value: string): bigint | null {
  try {
    const v = toUnits(value);
    return v > 0n ? v : null;
  } catch {
    return null;
  }
}

function Bar({ funded, target }: { funded: bigint; target: bigint }) {
  const pct = target === 0n ? 0 : Number((funded * 1000n) / target) / 10;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
      <div className="h-full bg-aegis-gold" style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function FacilityCard({ row, onAction, active }: { row: Row; onAction: (label: string, build: () => Promise<PreparedTransaction>) => void; active?: React.ReactNode }) {
  const { address } = useWallet();
  const client = getClient();
  const { facility: f, position: p } = row;
  const [amount, setAmount] = useState('1');
  const units = parse(amount);
  const isBorrower = address === f.borrower;
  const remaining = f.seniorOwed + f.juniorOwed - f.repaidAmount;
  const fullyFunded = f.seniorFunded >= f.seniorTarget && f.juniorFunded >= f.juniorTarget;

  const actions: [string, () => Promise<PreparedTransaction>][] = [];
  if (address) {
    if (f.status === 'Fundraising' && units) {
      if (f.seniorFunded < f.seniorTarget) actions.push([`Fund senior ${amount} USDC`, () => client.depositTranche(address, f.id, SENIOR, units)]);
      if (f.juniorFunded < f.juniorTarget) actions.push([`Fund junior ${amount} USDC`, () => client.depositTranche(address, f.id, JUNIOR, units)]);
    }
    if (f.status === 'Fundraising' && isBorrower && fullyFunded) actions.push(['Draw down', () => client.drawdown(address, f.id)]);
    if (f.status === 'Fundraising' && isBorrower) actions.push(['Cancel facility', () => client.cancelFacility(address, f.id)]);
    if ((f.status === 'Active' || f.status === 'Defaulted') && units) actions.push([`Repay ${amount} USDC`, () => client.repay(address, f.id, units)]);
    if ((f.status === 'Active' || f.status === 'Defaulted') && isBorrower && remaining > 0n) {
      actions.push([`Repay all (${fmtUnits(remaining, 7)})`, () => client.repay(address, f.id, remaining)]);
    }
    if (p && p.claimable > 0n) actions.push([`Claim ${fmtUnits(p.claimable, 7)} USDC`, () => client.claim(address, f.id)]);
    if (f.status === 'Cancelled' && p && p.senior + p.junior > 0n) actions.push(['Refund deposits', () => client.refund(address, f.id)]);
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-white">#{f.id}</span>
            <Badge tone={STATUS_TONE[f.status]}>{f.status}</Badge>
            {isBorrower && <Badge tone="slate">Your facility</Badge>}
          </div>
          <div className="mt-1 truncate text-xs text-slate-400" title={f.invoiceRef}>
            Invoice ref “{f.invoiceRef}” (borrower-supplied, not verified) · borrower {shortAddr(f.borrower)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Stat label={`Senior · ${f.seniorAprBps / 100}% APR`} value={`${fmtUnits(f.seniorFunded)} / ${fmtUnits(f.seniorTarget)} USDC`} />
          <Bar funded={f.seniorFunded} target={f.seniorTarget} />
        </div>
        <div className="space-y-1">
          <Stat label={`Junior · ${f.juniorAprBps / 100}% APR`} value={`${fmtUnits(f.juniorFunded)} / ${fmtUnits(f.juniorTarget)} USDC`} />
          <Bar funded={f.juniorFunded} target={f.juniorTarget} />
        </div>
        <Stat label="Owed (senior + junior)" value={`${fmtUnits(f.seniorOwed + f.juniorOwed, 7)} USDC`} />
        <Stat label="Repaid" value={`${fmtUnits(f.repaidAmount, 7)} USDC`} />
        <Stat
          label={f.dueTimestamp ? 'Due' : 'Term'}
          value={f.dueTimestamp ? new Date(f.dueTimestamp * 1000).toLocaleString() : `${(f.durationSeconds / 86_400).toLocaleString()} days`}
        />
        {p && (p.senior > 0n || p.junior > 0n) && (
          <Stat label="Your position" value={`S ${fmtUnits(p.senior)} · J ${fmtUnits(p.junior)} · claimed ${fmtUnits(p.claimed, 7)}`} />
        )}
      </div>

      {address && actions.length > 0 && (
        <div className="space-y-2 border-t border-aegis-border/60 pt-3">
          {(f.status === 'Fundraising' || f.status === 'Active' || f.status === 'Defaulted') && (
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="USDC amount" />
          )}
          <div className="flex flex-wrap gap-2">
            {actions.map(([text, build]) => (
              <Button key={text} variant="secondary" onClick={() => onAction(`${text} · facility #${f.id}`, build)}>
                {text}
              </Button>
            ))}
          </div>
        </div>
      )}
      {active}
    </Card>
  );
}

export function CreditSection() {
  const { address, status, refreshKey } = useWallet();
  const client = getClient();
  const [rows, setRows] = useState<Row[]>();
  const [error, setError] = useState<string>();
  const [reload, setReload] = useState(0);
  const [form, setForm] = useState({ invoice: '', senior: '6', junior: '2', seniorApr: '10', juniorApr: '20', days: '30' });
  const create = useSorobanTx();
  const rowTx = useSorobanTx();
  const [rowAction, setRowAction] = useState<{ id: number; label: string }>();

  useEffect(() => {
    let cancelled = false;
    setError(undefined);
    (async () => {
      const facilities = await client.listFacilities(20);
      const positions = address
        ? await Promise.all(facilities.map((f) => client.getPosition(f.id, address)))
        : facilities.map(() => undefined);
      return facilities.map((facility, i) => ({ facility, position: positions[i] }));
    })()
      .then((r) => !cancelled && setRows(r))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [client, address, refreshKey, reload]);

  const senior = parse(form.senior);
  const junior = parse(form.junior);
  const valid = form.invoice.trim().length > 0 && senior !== null && junior !== null && Number(form.days) > 0;

  return (
    <Section
      id="credit"
      eyebrow="Structured credit"
      title="Two-tranche trade-credit facilities"
      description="A borrower opens a facility with senior and junior USDC targets. Investors fund either tranche; once both are full the borrower draws the USDC. Repayments are paid senior-first: senior principal plus interest is covered before junior receives anything, so junior absorbs losses first. Investors claim their share as repayments arrive."
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <div className="text-sm font-semibold text-white">Open a facility</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="col-span-2 block min-w-0">
              <span className="text-[11px] uppercase tracking-wider text-slate-500">Invoice reference (free text)</span>
              <Input value={form.invoice} placeholder="e.g. your invoice number" onChange={(e) => setForm({ ...form, invoice: e.target.value })} />
            </label>
            {(
              [
                ['senior', 'Senior target (USDC)'],
                ['junior', 'Junior target (USDC)'],
                ['seniorApr', 'Senior APR (%)'],
                ['juniorApr', 'Junior APR (%)'],
                ['days', 'Term (days)'],
              ] as const
            ).map(([key, text]) => (
              <label key={key} className="block min-w-0">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">{text}</span>
                <Input inputMode="decimal" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </label>
            ))}
          </div>
          {status === 'connected' && address ? (
            <>
              <Button
                className="mt-3 w-full"
                disabled={!valid || create.state.phase !== 'idle'}
                onClick={() =>
                  create.prepare(() =>
                    client.createFacility(address, {
                      invoiceRef: form.invoice.trim(),
                      currencyToken: client.deployment.assets.cash.contractId,
                      seniorTarget: senior!,
                      juniorTarget: junior!,
                      seniorAprBps: Math.round(Number(form.seniorApr) * 100),
                      juniorAprBps: Math.round(Number(form.juniorApr) * 100),
                      durationSeconds: Math.round(Number(form.days) * 86_400),
                    })
                  )
                }
              >
                Review facility
              </Button>
              <TxReview
                state={create.state}
                onConfirm={create.confirm}
                onCancel={create.reset}
                explainError={explainError}
                describeResult={(v) => `Facility #${String(v)} is open for funding.`}
              />
            </>
          ) : (
            <p className="mt-3 text-xs text-slate-400">Connect Freighter to open, fund, repay or claim.</p>
          )}
        </Card>

        <div className="space-y-4 lg:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-white">Facilities (read from the contract)</span>
            <Button variant="secondary" onClick={() => setReload((r) => r + 1)} className="px-3" aria-label="Reload facilities">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          {error && <ErrorBox>Could not read facilities: {error}</ErrorBox>}
          {!rows && !error && <Loading label="Reading credit facilities…" />}
          {rows && rows.length === 0 && <p className="text-sm text-slate-400">No facilities yet.</p>}
          {rows?.map((row) => (
            <FacilityCard
              key={row.facility.id}
              row={row}
              onAction={(label, build) => {
                setRowAction({ id: row.facility.id, label });
                rowTx.prepare(build);
              }}
              active={
                rowAction?.id === row.facility.id && rowTx.state.phase !== 'idle' ? (
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
        </div>
      </div>
      <div className="mt-4">
        <NoteBox>
          Facilities here are opened by whoever connects; the invoice reference is borrower-supplied text and Aegis does
          not verify invoices or exporters yet. A facility can be marked defaulted 7 days after its due date; later
          repayments still flow down the same waterfall.
        </NoteBox>
      </div>
    </Section>
  );
}
