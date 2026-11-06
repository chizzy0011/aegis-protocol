'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  TEST_ANCHOR_DOMAIN,
  getSep10Challenge,
  getSep10Token,
  getSep24Info,
  getSep24Transaction,
  resolveAnchor,
  startSep24Withdraw,
  type AnchorInfo,
  type Sep24AssetInfo,
} from '@aegis-protocol/sdk';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { Badge, Button, Card, ErrorBox, ExtLink, Input, Loading, NoteBox, Section, Stat } from './ui';
import { useWallet } from './WalletProvider';
import { NETWORK, errorMessage } from '@/lib/aegis';

const STEPS = [
  'Fetch and verify the SEP-10 challenge',
  'Sign the challenge in Freighter',
  'Exchange it for a session token',
  'Open a SEP-24 withdrawal',
] as const;

export function OffRampSection() {
  const { status, address, onTestnet, sign } = useWallet();
  const [anchor, setAnchor] = useState<AnchorInfo>();
  const [usdcInfo, setUsdcInfo] = useState<Sep24AssetInfo | null>();
  const [infoError, setInfoError] = useState<string>();
  const [amount, setAmount] = useState('5');
  const [step, setStep] = useState(-1);
  const [flowError, setFlowError] = useState<string>();
  const [session, setSession] = useState<{ id: string; url: string; token: string }>();
  const [txStatus, setTxStatus] = useState<string>();
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const a = await resolveAnchor(TEST_ANCHOR_DOMAIN);
        const info = await getSep24Info(a);
        if (!cancelled) {
          setAnchor(a);
          setUsdcInfo(info.withdraw?.USDC ?? null);
        }
      } catch (err) {
        if (!cancelled) setInfoError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Follow the anchor's view of the transaction once a session exists
  useEffect(() => {
    if (!session || !anchor) return;
    const check = async () => {
      try {
        setTxStatus((await getSep24Transaction(anchor, session.token, session.id)).status);
      } catch (err) {
        setTxStatus(`status unavailable (${errorMessage(err)})`);
      }
    };
    check();
    pollRef.current = setInterval(check, 8000);
    return () => clearInterval(pollRef.current);
  }, [session, anchor]);

  async function start() {
    if (!anchor || !address) return;
    setFlowError(undefined);
    setSession(undefined);
    setTxStatus(undefined);
    try {
      setStep(0);
      const challenge = await getSep10Challenge(anchor, address, NETWORK.networkPassphrase);
      setStep(1);
      const signed = await sign(challenge);
      setStep(2);
      const token = await getSep10Token(anchor, signed);
      setStep(3);
      const res = await startSep24Withdraw(anchor, token, { assetCode: 'USDC', account: address, amount });
      setStep(4);
      setSession({ id: res.id, url: res.url, token });
    } catch (err) {
      setFlowError(errorMessage(err));
    }
  }

  const running = step >= 0 && step < 4 && !flowError;
  const value = Number(amount);
  const outOfRange =
    !(value > 0) ||
    (usdcInfo?.min_amount !== undefined && value < usdcInfo.min_amount) ||
    (usdcInfo?.max_amount !== undefined && value > usdcInfo.max_amount);

  return (
    <Section
      id="offramp"
      eyebrow="Off-ramp"
      title="Cash out through a SEP-24 anchor"
      description="Authenticates with SEP-10 and opens a real SEP-24 withdrawal session. The anchor's USDC is the same Circle testnet USDC that Aegis repos and credit facilities settle in, so drawn or repaid USDC can go straight to the off-ramp."
    >
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-white">Stellar test anchor (SDF) · testnet</div>
          <Badge tone="amber">{TEST_ANCHOR_DOMAIN}</Badge>
        </div>

        <div className="mt-4">
          {!anchor && !infoError && <Loading label="Reading the anchor's stellar.toml and SEP-24 /info…" />}
          {infoError && <ErrorBox>Anchor unavailable: {infoError}</ErrorBox>}
          {anchor && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat
                label="USDC withdrawals"
                mono={false}
                value={usdcInfo?.enabled ? <Badge tone="green">Enabled</Badge> : <Badge tone="amber">Not offered</Badge>}
              />
              <Stat label="Min" value={usdcInfo?.min_amount !== undefined ? `${usdcInfo.min_amount} USDC` : 'Not stated'} />
              <Stat label="Max" value={usdcInfo?.max_amount !== undefined ? `${usdcInfo.max_amount.toLocaleString('en-US')} USDC` : 'Not stated'} />
              <Stat
                label="Fee"
                value={
                  usdcInfo?.fee_fixed !== undefined || usdcInfo?.fee_percent !== undefined
                    ? `${usdcInfo?.fee_fixed ?? 0} + ${usdcInfo?.fee_percent ?? 0}%`
                    : 'Set in the anchor flow'
                }
              />
            </div>
          )}
        </div>

        {anchor && usdcInfo?.enabled && (
          <div className="mt-5 border-t border-aegis-border/60 pt-5">
            {status !== 'connected' || !address ? (
              <p className="text-xs text-slate-400">Connect Freighter to authenticate with the anchor.</p>
            ) : (
              <>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <label className="block min-w-0 flex-1">
                    <span className="text-[11px] uppercase tracking-wider text-slate-500">USDC to withdraw</span>
                    <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </label>
                  <Button onClick={start} loading={running} disabled={!onTestnet || outOfRange}>
                    Start withdrawal
                  </Button>
                </div>
                {outOfRange && (
                  <p className="mt-2 text-xs text-amber-300">
                    Enter an amount within the anchor&apos;s limits ({usdcInfo?.min_amount ?? 0}–{usdcInfo?.max_amount ?? '∞'} USDC).
                  </p>
                )}

                {step >= 0 && (
                  <ol className="mt-4 space-y-1.5">
                    {STEPS.map((label, i) => (
                      <li key={label} className="flex items-center gap-2 text-xs">
                        {step > i ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : step === i && !flowError ? (
                          <Loader2 className="h-4 w-4 animate-spin text-aegis-accent" />
                        ) : (
                          <Circle className="h-4 w-4 text-slate-600" />
                        )}
                        <span className={step > i ? 'text-slate-200' : 'text-slate-400'}>{label}</span>
                      </li>
                    ))}
                  </ol>
                )}

                {flowError && (
                  <div className="mt-3">
                    <ErrorBox>{flowError}</ErrorBox>
                  </div>
                )}

                {session && (
                  <div className="mt-4 space-y-2 rounded-xl border border-aegis-accent/30 bg-aegis-accent/10 p-3 text-xs">
                    <div className="text-slate-200">
                      Anchor transaction <span className="break-all font-mono">{session.id}</span>
                      {txStatus && (
                        <>
                          {' '}
                          · status <span className="font-mono text-white">{txStatus}</span>
                        </>
                      )}
                    </div>
                    <ExtLink href={session.url} className="font-semibold">
                      Continue in the anchor&apos;s window (KYC and bank details)
                    </ExtLink>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="mt-5">
          <NoteBox>
            This is SDF&apos;s reference test anchor: it demonstrates the protocol flow and does not move real money. No
            production anchor is integrated yet.
          </NoteBox>
        </div>
      </Card>
    </Section>
  );
}
