'use client';

import React from 'react';
import { explorerTxUrl } from '@aegis-protocol/sdk';
import { Button, ErrorBox, ExtLink, Loading, Stat, SuccessBox } from './ui';
import type { TxState } from '@/lib/useSorobanTx';
import { NETWORK, stroopsToXlm } from '@/lib/aegis';
import { TransactionReceiptModal } from './TransactionReceiptModal';

/** Shows the real simulation numbers, then signing / submission / result */
export function TxReview({
  state,
  onConfirm,
  onCancel,
  describeResult,
  explainError,
}: {
  state: TxState;
  onConfirm: () => void;
  onCancel: () => void;
  describeResult?: (value: unknown) => React.ReactNode;
  explainError?: (message: string) => React.ReactNode;
}) {
  const { phase, prepared, result, error } = state;
  const [showReceipt, setShowReceipt] = React.useState(false);
  if (phase === 'idle') return null;

  return (
    <div className="mt-3 space-y-3">
      {phase === 'preparing' && <Loading label="Simulating on Soroban RPC…" />}

      {prepared && (phase === 'review' || phase === 'signing' || phase === 'submitting') && (
        <div className="rounded-xl border border-aegis-border bg-aegis-dark/60 p-3">
          <div className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">Simulation result (Soroban RPC)</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="CPU instructions" value={prepared.stats.instructions.toLocaleString('en-US')} />
            <Stat label="Resource fee" value={`${stroopsToXlm(prepared.stats.minResourceFee)} XLM`} />
            <Stat
              label="Ledger I/O"
              value={`${prepared.stats.diskReadBytes.toLocaleString('en-US')} B read · ${prepared.stats.writeBytes.toLocaleString('en-US')} B write`}
            />
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button onClick={onConfirm} loading={phase !== 'review'} className="sm:flex-1">
              {phase === 'review' ? 'Sign in Freighter & submit' : phase === 'signing' ? 'Waiting for Freighter…' : 'Submitting…'}
            </Button>
            <Button variant="secondary" onClick={onCancel} disabled={phase !== 'review'}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {phase === 'done' && result && (
        <>
          <SuccessBox>
            Confirmed in ledger {result.ledger.toLocaleString('en-US')}.{' '}
            {describeResult?.(result.returnValue)}{' '}
            <button type="button" className="underline" onClick={() => setShowReceipt(true)}>
              View receipt
            </button>{' '}
            <ExtLink href={explorerTxUrl(NETWORK, result.hash)}>View transaction</ExtLink>
          </SuccessBox>
          {showReceipt && <TransactionReceiptModal hash={result.hash} network={NETWORK} onClose={() => setShowReceipt(false)} />}
        </>
      )}

      {phase === 'error' && error && (
        <ErrorBox>
          <div>{error}</div>
          {explainError?.(error)}
        </ErrorBox>
      )}

      {(phase === 'done' || phase === 'error') && (
        <Button variant="secondary" onClick={onCancel} className="w-full sm:w-auto">
          Done
        </Button>
      )}
    </div>
  );
}
