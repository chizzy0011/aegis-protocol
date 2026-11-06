import React from 'react';
import { WalletProvider } from '@/components/WalletProvider';
import { Navbar } from '@/components/Navbar';
import { AccountPanel } from '@/components/AccountPanel';
import { ComplianceSection } from '@/components/ComplianceSection';
import { RepoSection } from '@/components/RepoSection';
import { CreditSection } from '@/components/CreditSection';
import { ActivitySection } from '@/components/ActivitySection';
import { OffRampSection } from '@/components/OffRampSection';
import { ContractsSection } from '@/components/ContractsSection';

const FLOW = [
  ['Verify', 'An on-chain compliance registry sets each participant’s tier; markets check it before every action.'],
  ['Repo', 'Borrow USDC against escrowed collateral with delivery-versus-payment and a fixed repurchase price.'],
  ['Credit', 'Fund senior or junior tranches of a facility; repayments flow senior-first and investors claim them.'],
  ['Cash out', 'Move USDC to a bank account through a SEP-24 anchor.'],
] as const;

export default function HomePage() {
  return (
    <WalletProvider>
      <div id="top" className="flex min-h-screen flex-col overflow-x-hidden bg-aegis-dark">
        <Navbar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4">
          <div className="py-12 sm:py-16">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> Live on Stellar testnet · not on mainnet yet
            </span>
            <h1 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Repo and structured credit,{' '}
              <span className="bg-gradient-to-r from-aegis-gold to-amber-200 bg-clip-text text-transparent">settled on Stellar</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400">
              Aegis is a set of Soroban contracts for secured short-term lending: bilateral repo with delivery-versus-payment,
              two-tranche credit facilities with a senior-first waterfall, and an on-chain compliance gate. Every number on
              this page is read from the chain or from the service named next to it.
            </p>
            <ol className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {FLOW.map(([title, body], i) => (
                <li key={title} className="rounded-2xl border border-aegis-border bg-aegis-card p-4">
                  <div className="text-xs font-bold text-aegis-gold">0{i + 1}</div>
                  <div className="mt-1 text-sm font-semibold text-white">{title}</div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{body}</p>
                </li>
              ))}
            </ol>
          </div>

          <AccountPanel />
          <ComplianceSection />
          <RepoSection />
          <CreditSection />
          <ActivitySection />
          <OffRampSection />
          <ContractsSection />
        </main>
        <footer className="border-t border-aegis-border/60 px-4 py-8 text-center text-xs text-slate-500">
          Aegis Protocol · Apache-2.0 ·{' '}
          <a href="https://github.com/chizzy0011/aegis-protocol" className="text-slate-400 hover:text-aegis-gold">
            Source on GitHub
          </a>
        </footer>
      </div>
    </WalletProvider>
  );
}
