'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  getAddress,
  getNetworkDetails,
  isAllowed,
  isConnected,
  requestAccess,
  signTransaction,
} from '@stellar/freighter-api';
import { getAccountBalances, type AccountBalances } from '@aegis-protocol/sdk';
import { NETWORK, errorMessage } from '@/lib/aegis';

type WalletStatus = 'checking' | 'not-installed' | 'disconnected' | 'connected';

interface WalletContextValue {
  status: WalletStatus;
  address?: string;
  /** Passphrase Freighter is currently set to */
  walletPassphrase?: string;
  onTestnet: boolean;
  connectError?: string;
  balances?: AccountBalances;
  balancesLoading: boolean;
  balancesError?: string;
  /** Bumped after every confirmed transaction so sections can reload */
  refreshKey: number;
  connect: () => Promise<void>;
  disconnect: () => void;
  sign: (xdr: string) => Promise<string>;
  refresh: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>');
  return ctx;
}

async function readNetwork(): Promise<string | undefined> {
  const details = await getNetworkDetails();
  return details.error ? undefined : details.networkPassphrase;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<WalletStatus>('checking');
  const [address, setAddress] = useState<string>();
  const [walletPassphrase, setWalletPassphrase] = useState<string>();
  const [connectError, setConnectError] = useState<string>();
  const [balances, setBalances] = useState<AccountBalances>();
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balancesError, setBalancesError] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);

  // Detect Freighter and silently restore a previously approved session
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const installed = await isConnected();
        if (cancelled) return;
        if (installed.error || !installed.isConnected) {
          setStatus('not-installed');
          return;
        }
        const allowed = await isAllowed();
        if (!allowed.error && allowed.isAllowed) {
          const res = await getAddress();
          if (!cancelled && !res.error && res.address) {
            setAddress(res.address);
            setWalletPassphrase(await readNetwork());
            setStatus('connected');
            return;
          }
        }
        if (!cancelled) setStatus('disconnected');
      } catch {
        if (!cancelled) setStatus('not-installed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    setConnectError(undefined);
    try {
      const installed = await isConnected();
      if (installed.error || !installed.isConnected) {
        setStatus('not-installed');
        return;
      }
      const res = await requestAccess();
      if (res.error || !res.address) {
        setConnectError(res.error?.message ?? 'Freighter did not share an address');
        return;
      }
      setAddress(res.address);
      setWalletPassphrase(await readNetwork());
      setStatus('connected');
    } catch (err) {
      setConnectError(errorMessage(err));
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(undefined);
    setBalances(undefined);
    setStatus('disconnected');
  }, []);

  const sign = useCallback(
    async (xdr: string) => {
      if (!address) throw new Error('Connect Freighter first');
      // Re-check the network right before signing; users switch networks mid-session
      const passphrase = await readNetwork();
      setWalletPassphrase(passphrase);
      if (passphrase && passphrase !== NETWORK.networkPassphrase) {
        throw new Error('Freighter is not on Testnet. Switch networks in Freighter and try again.');
      }
      const res = await signTransaction(xdr, { networkPassphrase: NETWORK.networkPassphrase, address });
      if (res.error) throw new Error(res.error.message ?? 'Signing was rejected');
      return res.signedTxXdr;
    },
    [address]
  );

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setBalancesLoading(true);
    setBalancesError(undefined);
    getAccountBalances(NETWORK, address)
      .then((b) => !cancelled && setBalances(b))
      .catch((err) => !cancelled && setBalancesError(errorMessage(err)))
      .finally(() => !cancelled && setBalancesLoading(false));
    return () => {
      cancelled = true;
    };
  }, [address, refreshKey]);

  const value: WalletContextValue = {
    status,
    address,
    walletPassphrase,
    onTestnet: !walletPassphrase || walletPassphrase === NETWORK.networkPassphrase,
    connectError,
    balances,
    balancesLoading,
    balancesError,
    refreshKey,
    connect,
    disconnect,
    sign,
    refresh,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
