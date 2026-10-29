import React from 'react';
import { Navbar } from '@/components/Navbar';
import { RepoDesk } from '@/components/RepoDesk';
import { CreditFacilityCard } from '@/components/CreditFacilityCard';
import { FiatSettlementModal } from '@/components/FiatSettlementModal';
import { SAMPLE_STRUCTURED_FACILITIES } from '@aegis-protocol/sdk';
import { Shield, Sparkles, TrendingUp, Layers, Building } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-aegis-dark">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-6 py-12 w-full">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-aegis-card border border-aegis-border text-xs text-aegis-gold mb-4 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Built on Stellar Soroban • Canton-Grade Institutional Architecture</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-4">
            Institutional Collateral Clearing &{' '}
            <span className="bg-gradient-to-r from-aegis-gold via-amber-200 to-amber-500 bg-clip-text text-transparent">
              Global Structured Credit
            </span>
          </h1>

          <p className="text-slate-400 text-base max-w-2xl mx-auto leading-relaxed">
            Aegis combines Canton-style bilateral repo clearing for tokenized sovereign Treasuries
            with senior/junior structured trade finance facilities settled directly via Stellar fiat anchors.
          </p>
        </div>

        {/* Section 1: Bilateral Repo Clearing Desk */}
        <section id="repo" className="mb-16">
          <RepoDesk />
        </section>

        {/* Section 2: Structured Trade Credit Facilities */}
        <section id="credit" className="mb-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-aegis-accent uppercase tracking-wider mb-1">
                <Layers className="w-4 h-4" />
                <span>Tranche Waterfall Engine</span>
              </div>
              <h2 className="text-2xl font-bold text-white">
                Emerging Market Trade Credit Facilities
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Real-world trade receivables and export invoices backed by senior/junior risk tranches
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>3 Verified Active Pools</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SAMPLE_STRUCTURED_FACILITIES.map((facility) => (
              <CreditFacilityCard key={facility.id} facility={facility} />
            ))}
          </div>
        </section>

        {/* Section 3: Fiat Anchor Settlement Network */}
        <FiatSettlementModal />
      </main>

      <footer className="border-t border-aegis-border py-8 bg-aegis-dark/90 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Aegis Protocol. Institutional DvP & Structured Credit on Stellar Soroban.</p>
          <div className="flex items-center gap-6">
            <a href="https://github.com/chizzy0011/aegis-protocol" className="hover:text-slate-300">
              GitHub Repository
            </a>
            <a href="https://docs.drips.network/wave" className="hover:text-slate-300">
              Drips Wave Program
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
