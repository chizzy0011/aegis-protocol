'use client';

import React from 'react';
import { CheckCircle2, ExternalLink, X } from 'lucide-react';

export type StellarNetwork = 'public' | 'testnet';

export function stellarExpertTransactionUrl(hash: string, network: StellarNetwork): string {
  const host = network === 'testnet' ? 'testnet.stellarexpert.io' : 'stellar.expert';
  return `https://${host}/explorer/${network}/tx/${encodeURIComponent(hash)}`;
}

type TransactionReceiptModalProps = {
  hash: string;
  network: StellarNetwork;
  onClose: () => void;
};

export function TransactionReceiptModal({ hash, network, onClose }: TransactionReceiptModalProps) {
  const explorerUrl = stellarExpertTransactionUrl(hash, network);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
      <div className="w-full max-w-md rounded-2xl border border-aegis-border bg-aegis-card p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-400" aria-hidden="true" />
            <div>
              <h2 id="receipt-title" className="text-lg font-bold text-white">Transaction receipt</h2>
              <p className="mt-1 text-sm text-slate-400">Demo receipt on the {network} network.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close receipt" className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <dl className="mt-6 space-y-3 rounded-xl border border-aegis-border bg-aegis-dark/70 p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Status</dt>
            <dd className="font-semibold text-emerald-400">Submitted</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Transaction hash</dt>
            <dd className="max-w-[210px] truncate font-mono text-xs text-slate-200" title={hash}>{hash}</dd>
          </div>
        </dl>

        <a href={explorerUrl} target="_blank" rel="noreferrer" className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-aegis-gold px-4 py-3 text-sm font-extrabold text-black hover:brightness-110">
          View on Stellar Expert
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
