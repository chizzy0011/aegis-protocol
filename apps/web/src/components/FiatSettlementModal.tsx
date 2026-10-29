import React from 'react';
import { STELLAR_FIAT_ANCHOR_DIRECTORY } from '@aegis-protocol/sdk';
import { Building2, ArrowDownLeft, Clock, ShieldCheck } from 'lucide-react';

export function FiatSettlementModal() {
  const anchors = Object.entries(STELLAR_FIAT_ANCHOR_DIRECTORY);

  return (
    <div id="anchors" className="bg-aegis-card border border-aegis-border rounded-2xl p-6 shadow-2xl my-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-aegis-border gap-4">
        <div>
          <span className="text-[11px] font-bold text-aegis-gold uppercase tracking-wider">
            Stellar SEP-24 / SEP-6 Anchor Rails
          </span>
          <h2 className="text-xl font-bold text-white mt-1">
            Real-World Economic Settlement Network
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            When structured credit facilities are funded, capital is disbursed directly into emerging market bank accounts in local fiat currencies with automated repayment conversion.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-aegis-dark border border-aegis-border text-xs text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>4 Licensed Live Anchors</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {anchors.map(([key, anchor]) => (
          <div key={key} className="bg-aegis-dark/80 rounded-xl p-4 border border-aegis-border">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-aegis-gold px-2 py-0.5 rounded bg-aegis-gold/15 border border-aegis-gold/20">
                {anchor.fiatCode}
              </span>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                ~{anchor.averageSettlementMinutes} mins
              </span>
            </div>
            <h4 className="font-semibold text-white text-sm mt-1">{anchor.name}</h4>
            <p className="text-xs text-slate-400 mt-0.5">{anchor.country}</p>
            <div className="mt-4 pt-3 border-t border-aegis-border/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-mono truncate max-w-[120px]">
                {anchor.issuerPublicKey}
              </span>
              <span className="text-emerald-400 font-semibold">Active</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
