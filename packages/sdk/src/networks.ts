export type AegisNetwork = 'testnet' | 'mainnet';

export interface NetworkConfig {
  network: AegisNetwork;
  rpcUrl: string;
  horizonUrl: string;
  networkPassphrase: string;
  friendbotUrl?: string;
  /** stellar.expert base URL for this network */
  explorerUrl: string;
  /** Circle USDC: classic asset + its Stellar Asset Contract */
  usdc: { code: 'USDC'; issuer: string; contractId: string };
  /** Native XLM Stellar Asset Contract */
  nativeContractId: string;
}

export const NETWORKS: Record<AegisNetwork, NetworkConfig> = {
  testnet: {
    network: 'testnet',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
    friendbotUrl: 'https://friendbot.stellar.org',
    explorerUrl: 'https://stellar.expert/explorer/testnet',
    usdc: {
      code: 'USDC',
      issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      contractId: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
    },
    nativeContractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  },
  mainnet: {
    network: 'mainnet',
    // SDF does not run a public mainnet RPC; set MERIDIAN_MAINNET_RPC_URL to your provider.
    rpcUrl: 'https://mainnet.sorobanrpc.com',
    horizonUrl: 'https://horizon.stellar.org',
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
    explorerUrl: 'https://stellar.expert/explorer/public',
    usdc: {
      code: 'USDC',
      issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
      contractId: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
    },
    nativeContractId: 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA',
  },
};

/** USDC and XLM both use 7 decimals on Stellar */
export const STELLAR_DECIMALS = 7;

export function toUnits(amount: string | number): bigint {
  const [whole, frac = ''] = String(amount).trim().split('.');
  if (!/^\d*$/.test(whole) || !/^\d*$/.test(frac) || (whole === '' && frac === '')) {
    throw new Error(`Invalid amount: ${amount}`);
  }
  if (frac.length > STELLAR_DECIMALS) {
    throw new Error(`Amount has more than ${STELLAR_DECIMALS} decimal places: ${amount}`);
  }
  return BigInt(whole || '0') * 10n ** BigInt(STELLAR_DECIMALS) + BigInt(frac.padEnd(STELLAR_DECIMALS, '0') || '0');
}

export function fromUnits(units: bigint | number | string, maxDecimals = STELLAR_DECIMALS): string {
  const value = BigInt(units);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(STELLAR_DECIMALS);
  const whole = abs / base;
  const frac = (abs % base).toString().padStart(STELLAR_DECIMALS, '0').slice(0, maxDecimals).replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`;
}

export function explorerTxUrl(config: NetworkConfig, hash: string): string {
  return `${config.explorerUrl}/tx/${hash}`;
}

export function explorerContractUrl(config: NetworkConfig, contractId: string): string {
  return `${config.explorerUrl}/contract/${contractId}`;
}

export function explorerAccountUrl(config: NetworkConfig, account: string): string {
  return `${config.explorerUrl}/account/${account}`;
}
