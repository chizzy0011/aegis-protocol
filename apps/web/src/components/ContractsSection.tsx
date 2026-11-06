import React from 'react';
import { DEPLOYMENTS, explorerAccountUrl, explorerContractUrl, explorerTxUrl } from '@aegis-protocol/sdk';
import { Card, ExtLink, NoteBox, Section } from './ui';
import { NETWORK, shortAddr } from '@/lib/aegis';

const deployment = DEPLOYMENTS.testnet;

const ROLES: Record<string, string> = {
  compliance: 'Investor registry: tier, country, sanctions and expiry. Both markets gate on tier_of().',
  repo: 'Bilateral DvP repo: collateral escrow, atomic funding, repurchase, cancellation and liquidation.',
  credit: 'Two-tranche credit facilities with a senior-first repayment waterfall and investor claims.',
  settlement: 'Record of anchor off-ramps for drawn facilities, confirmed by the anchor. No funds move here; not exercised on testnet yet.',
};

export function ContractsSection() {
  if (!deployment) {
    return (
      <Section id="contracts" eyebrow="Deployments" title="Contracts">
        <NoteBox>Not deployed yet.</NoteBox>
      </Section>
    );
  }
  return (
    <Section
      id="contracts"
      eyebrow="Deployments"
      title="Contracts on Stellar testnet"
      description={
        <>
          Deployed {new Date(deployment.deployedAt).toUTCString()} by admin{' '}
          <ExtLink href={explorerAccountUrl(NETWORK, deployment.admin)} className="font-mono">
            {shortAddr(deployment.admin, 6, 6)}
          </ExtLink>
          . Not deployed to mainnet.
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Object.entries(deployment.contracts).map(([name, id]) => (
          <Card key={id}>
            <div className="text-sm font-bold capitalize text-white">Aegis {name}</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{ROLES[name]}</p>
            <div className="mt-3 break-all rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 font-mono text-xs text-slate-200">{id}</div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <ExtLink href={explorerContractUrl(NETWORK, id)}>Stellar Expert</ExtLink>
              {deployment.txs[`${name}Init`] && <ExtLink href={explorerTxUrl(NETWORK, deployment.txs[`${name}Init`])}>Init transaction</ExtLink>}
            </div>
          </Card>
        ))}
      </div>
    </Section>
  );
}
