'use client';

import React, { useState } from 'react';
import { Shield, Building2, Wallet, CheckCircle, ExternalLink } from 'lucide-react';

export function Navbar() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [account, setAccount] = useState('G...AEGIS');

  const handleConnect = () => {
    setWalletConnected(true);
    setAccount('GB7...9XQ (Freighter)');
  };

  return (
    <header className="border-b border-aegis-border bg-aegis-dark/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-aegis-gold to-amber-200 flex items-center justify-center text-black font-extrabold shadow-lg shadow-amber-500/20">
            <Shield className="w-5 h-5 text-black fill-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">AEGIS</span>
              <span className="text-[10px] font-mono uppercase bg-aegis-gold/15 text-aegis-gold border border-aegis-gold/30 px-2 py-0.5 rounded-full font-semibold">
                PRIME DVP
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Institutional Clearing & Structured Credit
            </p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <a href="#repo" className="hover:text-aegis-gold transition-colors">
            Repo Clearing Desk
          </a>
          <a href="#credit" className="hover:text-aegis-gold transition-colors">
            Structured Trade Credit
          </a>
          <a href="#anchors" className="hover:text-aegis-gold transition-colors">
            Fiat Anchor Settlement
          </a>
          <a
            href="https://github.com/chizzy0011/aegis-protocol"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
          >
            <span>GitHub</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-aegis-card border border-aegis-border text-xs text-slate-300">
            <Building2 className="w-3.5 h-3.5 text-aegis-gold" />
            <span>SEP-8 Verified</span>
          </div>

          <button
            onClick={handleConnect}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition shadow-sm ${
              walletConnected
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-gradient-to-r from-aegis-gold to-amber-400 text-black font-bold hover:brightness-110 shadow-amber-500/20'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>{walletConnected ? account : 'Connect Institution'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
