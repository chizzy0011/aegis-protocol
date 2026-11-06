'use client';

import React, { useEffect, useState } from 'react';
import {
  explorerAccountUrl,
  explorerTxUrl,
  fundWithFriendbot,
  prepareUsdcTrustline,
  prepareXlmToUsdcSwap,
  quoteXlmToUsdc,
  submitClassicTransaction,
  type UsdcQuote,
} from '@aegis-protocol/sdk';
import { RefreshCw } from 'lucide-react';
import { Badge, Button, Card, ErrorBox, ExtLink, Input, Loading, NoteBox, Section, Stat, SuccessBox } from './ui';
import { useWallet } from './WalletProvider';
import { NETWORK, errorMessage, fmtAmount, shortAddr } from '@/lib/aegis';

type Action = { busy: string | null; error?: string; done?: { label: string; hash?: string } };

export function AccountPanel() {
  const { status, address, onTestnet, connect, connectError, balances, balancesLoading, balancesError, sign, refresh } =
    useWallet();
  const [action, setAction] = useState<Action>({ busy: null });
  const [xlmIn, setXlmIn] = useState('50');
  const [quote, setQuote] = useState<UsdcQuote | null>();
  const [quoteError, setQuoteError] = useState<string>();
  const [quoting, setQuoting] = useState(false);

  // Live DEX quote, debounced while typing
  useEffect(() => {
    setQuote(undefined);
    setQuoteError(undefined);
    const amount = Number(xlmIn);
    if (!address || !(amount > 0)) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setQuoting(true);
      try {
        const q = await quoteXlmToUsdc(NETWORK, Number(xlmIn).toFixed(7));
        if (!cancelled) setQuote(q);
      } catch (err) {
        if (!cancelled) setQuoteError(errorMessage(err));
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [xlmIn, address]);

  async function run(label: string, fn: () => Promise<string | undefined>) {
    setAction({ busy: label });
    try {
      const hash = await fn();
      setAction({ busy: null, done: { label, hash } });
      refresh();
    } catch (err) {
      setAction({ busy: null, error: errorMessage(err) });
    }
  }

  const signAndSubmit = async (unsignedXdr: string) =>
    (await submitClassicTransaction(NETWORK, await sign(unsignedXdr))).hash;

  return (
    <Section
      id="account"
      eyebrow="Step 1"
      title="Your testnet account"
      description={
        <>
          Aegis runs on Stellar testnet with Circle&apos;s testnet USDC (issuer{' '}
          <span className="font-mono">{shortAddr(NETWORK.usdc.issuer, 6, 4)}</span>). Fund an account, add the USDC
          trustline, and buy USDC on the Stellar DEX at the live market rate.
        </>
      }
    >
      <Card>
        {status === 'checking' && <Loading label="Looking for Freighter…" />}

        {status === 'not-installed' && (
          <NoteBox>
            Freighter wasn&apos;t detected. Install it from{' '}
            <ExtLink href="https://www.freighter.app/">freighter.app</ExtLink>, switch it to Testnet, then reload this
            page. Everything below that only reads the chain still works without a wallet.
          </NoteBox>
        )}

        {status === 'disconnected' && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-300">Connect Freighter (set to Testnet) to deposit, withdraw and off-ramp.</p>
            <Button onClick={connect}>Connect Freighter</Button>
          </div>
        )}
        {connectError && (
          <div className="mt-3">
            <ErrorBox>{connectError}</ErrorBox>
          </div>
        )}

        {status === 'connected' && address && (
          <div className="space-y-5">
            {!onTestnet && (
              <ErrorBox>Freighter is not set to Testnet. Switch networks in Freighter before signing anything here.</ErrorBox>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <ExtLink href={explorerAccountUrl(NETWORK, address)} className="font-mono text-xs">
                {address}
              </ExtLink>
              <Button variant="secondary" onClick={refresh} loading={balancesLoading} className="px-3">
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
            </div>

            {balancesError && <ErrorBox>Could not load balances: {balancesError}</ErrorBox>}

            {balances && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Stat label="XLM" value={balances.exists ? fmtAmount(balances.xlm) : '—'} />
                <Stat label="USDC" value={balances.hasUsdcTrustline ? fmtAmount(balances.usdc) : '—'} />
                <Stat
                  label="USDC trustline"
                  mono={false}
                  value={
                    balances.hasUsdcTrustline ? <Badge tone="green">Active</Badge> : <Badge tone="amber">Missing</Badge>
                  }
                />
              </div>
            )}

            {balances && !balances.exists && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-300">This account doesn&apos;t exist on testnet yet.</p>
                <Button
                  loading={action.busy === 'Friendbot'}
                  onClick={() =>
                    run('Friendbot', async () => {
                      await fundWithFriendbot(NETWORK, address);
                      return undefined;
                    })
                  }
                >
                  Fund with Friendbot
                </Button>
              </div>
            )}

            {balances?.exists && !balances.hasUsdcTrustline && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-300">Add a trustline so the account can hold USDC.</p>
                <Button
                  loading={action.busy === 'Trustline'}
                  onClick={() => run('Trustline', async () => signAndSubmit(await prepareUsdcTrustline(NETWORK, address)))}
                >
                  Add USDC trustline
                </Button>
              </div>
            )}

            {balances?.hasUsdcTrustline && (
              <div className="rounded-xl border border-aegis-border/70 bg-aegis-dark/50 p-4">
                <div className="mb-2 text-sm font-semibold text-white">Buy USDC with XLM on the Stellar DEX</div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="block min-w-0 flex-1">
                    <span className="text-[11px] uppercase tracking-wider text-slate-500">XLM to sell</span>
                    <Input inputMode="decimal" value={xlmIn} onChange={(e) => setXlmIn(e.target.value)} />
                  </label>
                  <Button
                    disabled={!quote}
                    loading={action.busy === 'Swap'}
                    onClick={() =>
                      quote && run('Swap', async () => signAndSubmit(await prepareXlmToUsdcSwap(NETWORK, address, quote)))
                    }
                  >
                    Swap
                  </Button>
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  {quoting && 'Fetching a live path quote from Horizon…'}
                  {!quoting && quote && (
                    <>
                      ≈ <span className="font-mono text-slate-200">{fmtAmount(quote.usdcOut)} USDC</span> via{' '}
                      {quote.path.length === 0 ? 'the direct XLM/USDC order book' : `${quote.path.length}-hop path`}; the
                      swap accepts up to 1% less.
                    </>
                  )}
                  {!quoting && quote === null && 'No DEX path found for this amount right now.'}
                  {quoteError && <span className="text-red-300">Quote failed: {quoteError}</span>}
                </div>
              </div>
            )}

            {action.error && <ErrorBox>{action.error}</ErrorBox>}
            {action.done && (
              <SuccessBox>
                {action.done.label} confirmed.{' '}
                {action.done.hash && <ExtLink href={explorerTxUrl(NETWORK, action.done.hash)}>View transaction</ExtLink>}
              </SuccessBox>
            )}
          </div>
        )}
      </Card>
    </Section>
  );
}
