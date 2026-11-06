import { AegisClient, NETWORKS, fromUnits } from '@aegis-protocol/sdk';

export const NETWORK = NETWORKS.testnet;

let client: AegisClient | null = null;

export function getClient(): AegisClient {
  if (!client) client = new AegisClient('testnet');
  return client;
}

export function shortAddr(value: string, head = 4, tail = 4): string {
  return value.length > head + tail + 1 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err && 'message' in err) return String((err as { message: unknown }).message);
  return String(err);
}

/** Display a 7-decimal on-chain amount with grouping */
export function fmtUnits(units: bigint | string | number, maxDecimals = 4): string {
  return Number(fromUnits(BigInt(units), maxDecimals)).toLocaleString('en-US', {
    maximumFractionDigits: maxDecimals,
  });
}

/** Display a human amount string (e.g. Horizon balances) with grouping */
export function fmtAmount(value: string | number, maxDecimals = 4): string {
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: maxDecimals });
}

export function stroopsToXlm(stroops: string | number): string {
  return (Number(stroops) / 10_000_000).toLocaleString('en-US', { maximumFractionDigits: 7 });
}

export function timeAgo(iso: string): string {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86_400) return `${Math.round(secs / 3600)}h ago`;
  return `${Math.round(secs / 86_400)}d ago`;
}
