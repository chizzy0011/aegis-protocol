'use client';

import React, { useEffect, useState } from 'react';
import { TIER_NAMES, type GateConfig } from '@aegis-protocol/sdk';
import { Badge, Card, ErrorBox, Loading, NoteBox, Section, Stat } from './ui';
import { useWallet } from './WalletProvider';
import { errorMessage, getClient } from '@/lib/aegis';

const tierLabel = (tier: number) => (tier === 0 ? 'Open to anyone' : `${TIER_NAMES[tier]} or above`);

export function ComplianceSection() {
  const { address, refreshKey } = useWallet();
  const [gates, setGates] = useState<{ repo: GateConfig; credit: GateConfig }>();
  const [tier, setTier] = useState<number>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    const client = getClient();
    Promise.all([client.getRepoConfig(), client.getCreditConfig(), address ? client.tierOf(address) : Promise.resolve(undefined)])
      .then(([repo, credit, t]) => {
        if (cancelled) return;
        setGates({ repo, credit });
        setTier(t);
      })
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [address, refreshKey]);

  return (
    <Section
      id="compliance"
      eyebrow="Compliance"
      title="Who can take part"
      description="Both markets read the AegisCompliance contract on-chain before every proposal, funding and deposit. A tier of 0 means unknown, sanctioned or expired."
    >
      <Card>
        {error && <ErrorBox>Could not read compliance settings: {error}</ErrorBox>}
        {!gates && !error && <Loading label="Reading compliance settings from testnet…" />}
        {gates && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Repo desk requires" mono={false} value={<Badge tone="amber">{tierLabel(gates.repo.requiredTier)}</Badge>} />
            <Stat label="Credit facilities require" mono={false} value={<Badge tone="green">{tierLabel(gates.credit.requiredTier)}</Badge>} />
            <Stat
              label="Your tier"
              mono={false}
              value={
                address === undefined ? (
                  <span className="text-slate-400">Connect Freighter to check</span>
                ) : tier === undefined ? (
                  '…'
                ) : (
                  <Badge tone={tier >= gates.repo.requiredTier ? 'green' : 'slate'}>
                    {tier} · {TIER_NAMES[tier]}
                  </Badge>
                )
              }
            />
          </div>
        )}
        <div className="mt-4">
          <NoteBox>
            On testnet, verification records are written by the Aegis admin; no KYC provider is integrated yet, so there
            is no self-serve verification. The credit pilot is open so anyone can try it with testnet USDC.
          </NoteBox>
        </div>
      </Card>
    </Section>
  );
}
