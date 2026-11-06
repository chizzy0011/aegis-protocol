'use client';

import { useCallback, useState } from 'react';
import type { PreparedTransaction, SubmittedTransaction } from '@aegis-protocol/sdk';
import { useWallet } from '@/components/WalletProvider';
import { errorMessage, getClient } from './aegis';

export type TxPhase = 'idle' | 'preparing' | 'review' | 'signing' | 'submitting' | 'done' | 'error';

export interface TxState {
  phase: TxPhase;
  prepared?: PreparedTransaction;
  result?: SubmittedTransaction;
  error?: string;
}

/**
 * Simulate -> review real resource numbers -> sign in Freighter -> submit and wait.
 * Nothing is shown as done until the network confirms it.
 */
export function useSorobanTx() {
  const { sign, refresh } = useWallet();
  const [state, setState] = useState<TxState>({ phase: 'idle' });

  const prepare = useCallback(async (build: () => Promise<PreparedTransaction>) => {
    setState({ phase: 'preparing' });
    try {
      setState({ phase: 'review', prepared: await build() });
    } catch (err) {
      setState({ phase: 'error', error: errorMessage(err) });
    }
  }, []);

  const confirm = useCallback(async () => {
    const prepared = state.prepared;
    if (!prepared) return;
    try {
      setState({ phase: 'signing', prepared });
      const signed = await sign(prepared.xdr);
      setState({ phase: 'submitting', prepared });
      const result = await getClient().submit(signed);
      setState({ phase: 'done', prepared, result });
      refresh();
    } catch (err) {
      setState({ phase: 'error', prepared, error: errorMessage(err) });
    }
  }, [state.prepared, sign, refresh]);

  const reset = useCallback(() => setState({ phase: 'idle' }), []);

  return { state, prepare, confirm, reset };
}
