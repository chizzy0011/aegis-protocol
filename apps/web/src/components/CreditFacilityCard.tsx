import React from 'react';
import { CreditFacilityInfo } from '@aegis-protocol/sdk';
import { Globe, TrendingUp, ShieldCheck, ArrowUpRight } from 'lucide-react';

export function CreditFacilityCard({ facility }: { facility: CreditFacilityInfo }) {
  const principalNum = parseFloat(facility.principalAmountUsdc);
  const seniorTarget = parseFloat(facility.seniorTrancheTarget);
  const juniorTarget = parseFloat(facility.juniorTrancheTarget);
  const seniorFunded = parseFloat(facility.seniorFunded);
  const fundedPercent = Math.round(((seniorFunded + parseFloat(facility.juniorFunded)) / principalNum) * 100);

  return (
    <div className="bg-aegis-card border border-aegis-border rounded-2xl p-6 hover:border-aegis-gold/50 transition-all shadow-xl flex flex-col justify-between group">
      <div>
        {/* Top Header */}
        <div className="flex justify-between items-start mb-4">
          <span className="text-[11px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded bg-aegis-blue/15 text-aegis-accent border border-aegis-blue/30 flex items-center gap-1.5">
            <Globe className="w-3 h-3" />
            {facility.originCountry} • {facility.fiatCurrency}
          </span>
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
              facility.status === 'Active'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
          >
            {facility.status}
          </span>
        </div>

        <h3 className="font-bold text-white text-lg mb-1 group-hover:text-aegis-gold transition-colors">
          {facility.exporterName}
        </h3>
        <p className="text-xs text-slate-400 mb-4 font-medium">
          {facility.commodityType}
        </p>

        {/* Tranche Display */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-aegis-dark/80 rounded-xl p-3 border border-aegis-border/60">
            <div className="text-[10px] uppercase font-semibold text-slate-400 mb-1 flex items-center justify-between">
              <span>Senior Tranche</span>
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
            </div>
            <div className="text-emerald-400 font-extrabold text-base">
              {facility.seniorApr} APY
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              ${(seniorTarget / 1000).toFixed(0)}k Protected
            </div>
          </div>

          <div className="bg-aegis-dark/80 rounded-xl p-3 border border-aegis-border/60">
            <div className="text-[10px] uppercase font-semibold text-slate-400 mb-1 flex items-center justify-between">
              <span>Junior Tranche</span>
              <TrendingUp className="w-3 h-3 text-aegis-gold" />
            </div>
            <div className="text-aegis-gold font-extrabold text-base">
              {facility.juniorApr} APY
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              ${(juniorTarget / 1000).toFixed(0)}k First-Loss
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Funding Progress</span>
            <span className="font-semibold text-white">{fundedPercent}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-aegis-blue to-emerald-400 h-full rounded-full"
              style={{ width: `${fundedPercent}%` }}
            />
          </div>
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-6">
          <span className="text-slate-500">Settled via:</span>
          <span className="font-medium text-slate-300">{facility.fiatAnchor}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-4 border-t border-aegis-border/60">
        <button className="w-full py-2.5 px-3 rounded-xl bg-aegis-blue/20 hover:bg-aegis-blue/30 text-aegis-accent font-semibold text-xs border border-aegis-blue/40 transition flex items-center justify-center gap-1">
          <span>Deposit Senior</span>
        </button>
        <button className="w-full py-2.5 px-3 rounded-xl bg-aegis-gold hover:brightness-110 text-black font-bold text-xs transition flex items-center justify-center gap-1">
          <span>Deposit Junior</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
