'use client';

import React, { useState } from 'react';
import { ArrowRight, Layers, Percent, Clock, ShieldCheck, DollarSign } from 'lucide-react';
import { SUPPORTED_REPO_COLLATERAL } from '@aegis-protocol/sdk';

export function RepoDesk() {
  const [selectedCollateral, setSelectedCollateral] = useState('spiko-eutbl');
  const [collateralAmount, setCollateralAmount] = useState('1000000');
  const [termDays, setTermDays] = useState(7);

  const collateralInfo = SUPPORTED_REPO_COLLATERAL[selectedCollateral] || {
    name: 'Spiko Euro T-Bills',
    issuer: 'Spiko / CACEIS',
    defaultHaircutBps: 200,
    benchmarkAprBps: 385,
  };

  const collateralNum = parseFloat(collateralAmount) || 0;
  const haircutPercent = collateralInfo.defaultHaircutBps / 100;
  const maxBorrow = collateralNum * (1 - haircutPercent / 100);
  const repoApr = collateralInfo.benchmarkAprBps / 100;
  const interestUsdc = (maxBorrow * (repoApr / 100) * (termDays * 86400)) / 31536000;
  const totalRepurchase = maxBorrow + interestUsdc;

  return (
    <div className="bg-aegis-card border border-aegis-border rounded-2xl p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-aegis-border">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Bilateral Repo & DvP Clearing</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Canton-grade collateral pledge & overnight cash borrowing on Stellar Soroban
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <ShieldCheck className="w-3.5 h-3.5" /> DTCC 2027 Spec
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Input Parameters */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Select Tokenized Collateral (Pledged Asset)
            </label>
            <select
              value={selectedCollateral}
              onChange={(e) => setSelectedCollateral(e.target.value)}
              className="w-full bg-aegis-dark border border-aegis-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-aegis-gold"
            >
              <option value="spiko-eutbl">Spiko Euro T-Bills (eurSAFO) - 2.0% Haircut</option>
              <option value="benji-ustbl">Franklin Templeton BENJI US Govt - 2.0% Haircut</option>
              <option value="wisdomtree-gov">WisdomTree Short-Term Treasury - 2.5% Haircut</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Collateral Amount (Face Value USD/EUR)
            </label>
            <div className="relative">
              <input
                type="number"
                value={collateralAmount}
                onChange={(e) => setCollateralAmount(e.target.value)}
                className="w-full bg-aegis-dark border border-aegis-border rounded-xl pl-8 pr-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-aegis-gold"
                placeholder="1000000"
              />
              <DollarSign className="w-4 h-4 text-slate-500 absolute left-2.5 top-3.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Repo Term Duration
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 7, 14, 30].map((days) => (
                <button
                  key={days}
                  onClick={() => setTermDays(days)}
                  className={`py-2 text-xs font-semibold rounded-lg border transition ${
                    termDays === days
                      ? 'bg-aegis-gold text-black border-aegis-gold'
                      : 'bg-aegis-dark border-aegis-border text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {days === 1 ? 'Overnight' : `${days} Days`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: DvP Clearing Summary */}
        <div className="bg-aegis-dark/70 rounded-xl p-5 border border-aegis-border flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Delivery-vs-Payment (DvP) Quote
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Borrowing Capacity (USDC)</span>
                <span className="font-mono font-bold text-emerald-400 text-base">
                  ${maxBorrow.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Institutional Haircut</span>
                <span className="font-mono text-slate-200">{haircutPercent.toFixed(1)}%</span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Repo Rate (Annualized)</span>
                <span className="font-mono text-aegis-gold font-semibold">{repoApr.toFixed(2)}% APR</span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Estimated Cost of Carry</span>
                <span className="font-mono text-slate-200">
                  ${interestUsdc.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDC
                </span>
              </div>

              <div className="pt-3 border-t border-aegis-border/60 flex justify-between items-center">
                <span className="text-xs text-slate-400">Total Repurchase at Maturity</span>
                <span className="font-mono font-bold text-white text-base">
                  ${totalRepurchase.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDC
                </span>
              </div>
            </div>
          </div>

          <button className="w-full mt-6 py-3 px-4 rounded-xl bg-gradient-to-r from-aegis-gold to-amber-400 text-black font-extrabold text-sm hover:brightness-110 transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2">
            <span>Execute Atomic DvP Repo</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
