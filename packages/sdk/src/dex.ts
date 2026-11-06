import { Asset, BASE_FEE, Horizon, Operation, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import type { NetworkConfig } from './networks.js';

export interface AccountBalances {
  exists: boolean;
  xlm: string;
  usdc: string;
  hasUsdcTrustline: boolean;
}

export interface UsdcQuote {
  xlmIn: string;
  usdcOut: string;
  path: Asset[];
}

export function usdcAsset(config: NetworkConfig): Asset {
  return new Asset(config.usdc.code, config.usdc.issuer);
}

export async function getAccountBalances(config: NetworkConfig, account: string): Promise<AccountBalances> {
  const res = await fetch(`${config.horizonUrl}/accounts/${account}`);
  if (res.status === 404) {
    return { exists: false, xlm: '0', usdc: '0', hasUsdcTrustline: false };
  }
  if (!res.ok) {
    throw new Error(`Horizon returned ${res.status} for ${account}`);
  }
  const data = (await res.json()) as { balances: Array<Record<string, string>> };
  const native = data.balances.find((b) => b.asset_type === 'native');
  const usdc = data.balances.find(
    (b) => b.asset_code === config.usdc.code && b.asset_issuer === config.usdc.issuer
  );
  return {
    exists: true,
    xlm: native?.balance ?? '0',
    usdc: usdc?.balance ?? '0',
    hasUsdcTrustline: Boolean(usdc),
  };
}

export async function fundWithFriendbot(config: NetworkConfig, account: string): Promise<void> {
  if (!config.friendbotUrl) {
    throw new Error(`Friendbot is not available on ${config.network}`);
  }
  const res = await fetch(`${config.friendbotUrl}?addr=${encodeURIComponent(account)}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body.includes('createAccountAlreadyExist') ? 'Account is already funded' : `Friendbot failed (${res.status})`);
  }
}

/** Best XLM -> USDC route on the Stellar DEX for a given XLM amount */
export async function quoteXlmToUsdc(config: NetworkConfig, xlmAmount: string): Promise<UsdcQuote | null> {
  const server = new Horizon.Server(config.horizonUrl);
  const res = await server.strictSendPaths(Asset.native(), xlmAmount, [usdcAsset(config)]).call();
  const best = [...res.records].sort(
    (a, b) => Number(b.destination_amount) - Number(a.destination_amount)
  )[0];
  if (!best) return null;
  return {
    xlmIn: xlmAmount,
    usdcOut: best.destination_amount,
    path: best.path.map((p: any) =>
      p.asset_type === 'native' ? Asset.native() : new Asset(p.asset_code, p.asset_issuer)
    ),
  };
}

async function buildClassic(config: NetworkConfig, account: string, op: xdr.Operation) {
  const server = new Horizon.Server(config.horizonUrl);
  const source = await server.loadAccount(account);
  return new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: config.networkPassphrase })
    .addOperation(op)
    .setTimeout(300)
    .build()
    .toXDR();
}

export function prepareUsdcTrustline(config: NetworkConfig, account: string): Promise<string> {
  return buildClassic(config, account, Operation.changeTrust({ asset: usdcAsset(config) }));
}

/** Path payment that swaps XLM for USDC on the DEX into the same account */
export function prepareXlmToUsdcSwap(
  config: NetworkConfig,
  account: string,
  quote: UsdcQuote,
  slippageBps = 100
): Promise<string> {
  const minOut = ((Number(quote.usdcOut) * (10_000 - slippageBps)) / 10_000).toFixed(7);
  return buildClassic(
    config,
    account,
    Operation.pathPaymentStrictSend({
      sendAsset: Asset.native(),
      sendAmount: quote.xlmIn,
      destination: account,
      destAsset: usdcAsset(config),
      destMin: minOut,
      path: quote.path,
    })
  );
}

export async function submitClassicTransaction(
  config: NetworkConfig,
  signedXdr: string
): Promise<{ hash: string; ledger: number }> {
  const server = new Horizon.Server(config.horizonUrl);
  try {
    const res = await server.submitTransaction(
      TransactionBuilder.fromXDR(signedXdr, config.networkPassphrase)
    );
    return { hash: res.hash, ledger: res.ledger };
  } catch (err: any) {
    const codes = err?.response?.data?.extras?.result_codes;
    throw new Error(codes ? `Horizon rejected the transaction: ${JSON.stringify(codes)}` : err.message);
  }
}
